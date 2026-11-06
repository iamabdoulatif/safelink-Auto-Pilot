// Importe le catalogue d'images officielles MikroTik en base.
//
// Source : le sitemap public de mikrotik.com, puis la galerie de
// chaque page produit. Pour chaque photographie de galerie, le
// fichier _lg.webp est téléchargé et stocké en bytea dans
// images_mikrotik ; les URL des variantes (miniature, XL, haute
// résolution) sont gardées pour référence. Les photographies restent
// la propriété de MikroTik : url_page et url_source tracent l'origine.
//
// Usage :
//   npm run images:mikrotik                (catalogue complet)
//   npm run images:mikrotik -- --limite 20 (échantillon)
// Relançable : chaque image est mise à jour par (produit, identifiant).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const BASE = "https://mikrotik.com";
const CDN = "https://cdn.mikrotik.com/web-assets/rb_images";
const AGENT = "SafeLink-Auto-Pilot/1.0 (catalogue interne; contact via mikrotik.com)";

function lireDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  try {
    const brut = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const ligne = brut.split("\n").find((l) => l.startsWith("DATABASE_URL="));
    if (ligne) return ligne.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
  } catch {
    // Pas de fichier local : l'erreur ci-dessous explique.
  }
  return "";
}

function decoderEntites(texte) {
  return texte
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&sup3;/g, "³")
    .replace(/&sup2;/g, "²")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .trim();
}

// Même normalisation que lib/modele-mikrotik.ts (le script est en
// JavaScript pur, il ne peut pas importer le module TypeScript).
function normaliserModele(brut) {
  return (brut ?? "")
    .replaceAll("³", "3")
    .replaceAll("²", "2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function recuperer(url, binaire = false) {
  const res = await fetch(url, {
    headers: { "User-Agent": AGENT, Accept: binaire ? "image/*" : "text/html" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return binaire ? Buffer.from(await res.arrayBuffer()) : await res.text();
}

// Extrait nom, code et photographies de galerie d'une page produit.
function analyserProduit(html, slug) {
  const og =
    html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "";
  const nom = decoderEntites(og.replace(/\s*\|\s*MikroTik\s*$/, "")) ||
    decoderEntites(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? slug);
  const code =
    html.match(/compareProductsTrigger\('([^']+)'\)/)?.[1] ??
    html.match(/Product code[\s\S]{0,200}?>([A-Za-z0-9][A-Za-z0-9+._-]{2,})</)?.[1] ??
    null;

  const debut = html.indexOf('wire:name="widgets.product-gallery"');
  const segment = debut >= 0 ? html.slice(debut, debut + 60000) : html;
  const hautes = new Map();
  for (const m of segment.matchAll(/rb_images\/(\d+)_hi_res\.png/g)) {
    hautes.set(m[1], `${CDN}/${m[1]}_hi_res.png`);
  }
  const vus = new Set();
  const photos = [];
  for (const m of segment.matchAll(/rb_images\/(\d+)_lg\.webp/g)) {
    if (vus.has(m[1])) continue;
    vus.add(m[1]);
    photos.push({
      identifiant: m[1],
      position: photos.length,
      urlSource: `${CDN}/${m[1]}_lg.webp`,
      urlMiniature: `${CDN}/${m[1]}_ts.webp`,
      urlGrande: `${CDN}/${m[1]}_xl.webp`,
      urlHauteResolution: hautes.get(m[1]) ?? null,
    });
  }
  return { nom, code, photos };
}

async function traiterProduit(pool, slug) {
  const urlPage = `${BASE}/product/${slug}`;
  const html = await recuperer(urlPage);
  const { nom, code, photos } = analyserProduit(html, slug);
  let importees = 0;
  for (const photo of photos) {
    const donnees = await recuperer(photo.urlSource, true);
    const empreinte = createHash("sha256").update(donnees).digest("hex");
    await pool.query(
      `INSERT INTO images_mikrotik (
         slug, nom_produit, cle_nom, code_produit, url_page,
         identifiant_image, position, url_source, url_miniature,
         url_grande, url_haute_resolution, donnees, type_mime,
         taille_octets, empreinte_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'image/webp',$13,$14)
       ON CONFLICT (slug, identifiant_image) DO UPDATE SET
         nom_produit = EXCLUDED.nom_produit,
         cle_nom = EXCLUDED.cle_nom, code_produit = EXCLUDED.code_produit,
         url_page = EXCLUDED.url_page, position = EXCLUDED.position,
         url_miniature = EXCLUDED.url_miniature, url_grande = EXCLUDED.url_grande,
         url_haute_resolution = EXCLUDED.url_haute_resolution,
         donnees = EXCLUDED.donnees, taille_octets = EXCLUDED.taille_octets,
         empreinte_sha256 = EXCLUDED.empreinte_sha256, maj_le = now()`,
      [
        slug, nom, normaliserModele(nom), code, urlPage,
        photo.identifiant, photo.position, photo.urlSource,
        photo.urlMiniature, photo.urlGrande, photo.urlHauteResolution,
        donnees, donnees.length, empreinte,
      ],
    );
    importees++;
  }
  return importees;
}

async function main() {
  const args = process.argv.slice(2);
  const limiteBrute = args[args.indexOf("--limite") + 1];
  const limite = args.includes("--limite") ? Number(limiteBrute) : Infinity;
  const chaine = lireDatabaseUrl();
  if (!chaine) {
    console.error("DATABASE_URL absente de l'environnement et de web/.env.local.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: chaine, max: 4 });

  const demandes = args
    .filter((a) => a.startsWith("--slug="))
    .map((a) => a.slice("--slug=".length))
    .filter(Boolean);
  const sitemap = await recuperer(`${BASE}/sitemap.xml`);
  const slugs = (
    demandes.length > 0
      ? demandes
      : [
          ...new Set(
            [...sitemap.matchAll(/<loc>https:\/\/mikrotik\.com\/product\/([^<]+)<\/loc>/g)].map(
              (m) => decodeURIComponent(m[1]),
            ),
          ),
        ]
  ).slice(0, limite);
  console.log(`${slugs.length} pages produits à traiter.`);

  let produits = 0;
  let images = 0;
  const echecs = [];
  const file = [...slugs];
  async function ouvrier() {
    for (;;) {
      const slug = file.shift();
      if (slug === undefined) return;
      try {
        const importees = await traiterProduit(pool, slug);
        images += importees;
      } catch (e) {
        echecs.push(`${slug} : ${e instanceof Error ? e.message : e}`);
      }
      produits++;
      if (produits % 25 === 0 || produits === slugs.length) {
        console.log(`  ${produits}/${slugs.length} produits, ${images} images`);
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => ouvrier()));
  await pool.end();

  console.log(
    `Terminé : ${images} images importées pour ${produits - echecs.length} produits, ${echecs.length} échec(s).`,
  );
  for (const echec of echecs.slice(0, 20)) console.log(`  échec : ${echec}`);
  if (echecs.length > 0) process.exit(2);
}

await main();
