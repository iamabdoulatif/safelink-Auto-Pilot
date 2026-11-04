import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { rosLecture, ErreurRouterOS } from "@/lib/routeros";

// Inscrit un routeur : nom + base d'API, connectivite verifiee aussitot.
// Sans connectivite, pas d'inscription : un routeur injoignable des le
// depart ne produirait que des releves "injoignable" et des stocks faux.
// Isole par tenant, comme la lecture du parc.
export async function POST(req: Request) {
  const { tenantId } = await session();
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const nom = typeof b.nom === "string" ? b.nom.trim() : "";
  const urlBase = typeof b.url_base === "string"
    ? b.url_base.trim().replace(/\/$/, "") : "";

  if (!nom || nom.length > 100) {
    return Response.json({ error: "nom obligatoire (1 a 100 caracteres)." },
      { status: 400 });
  }
  if (!/^https?:\/\/[^/\s]+(\/.*)?$/i.test(urlBase) || urlBase.length > 200) {
    return Response.json({ error: "url_base doit etre une URL http(s)." },
      { status: 400 });
  }

  try {
    await rosLecture(urlBase).get("/system/identity");
  } catch (e) {
    if (e instanceof ErreurRouterOS) {
      if (e.statut === 401 || e.statut === 403) {
        return Response.json(
          { error: "Identifiants ROUTEROS_USER/ROUTEROS_PASS invalides ou compte sans droit de lecture." },
          { status: 502 });
      }
      if (e.statut === 404) {
        return Response.json(
          { error: "API REST introuvable : saisissez l'URL de base du routeur, sans /webfig ni /rest." },
          { status: 502 });
      }
      return Response.json(
        { error: "RouterOS répond avec HTTP " + e.statut + " : vérifiez le port et l'URL REST." },
        { status: 502 });
    }
    // Panne reseau : on dit QUOI verifier, sans jamais renvoyer l'URL
    // telle quelle (elle pourrait contenir un identifiant).
    const texte = String(
      (e as { cause?: unknown }).cause ?? (e as Error).message ?? e,
    );
    if (/ENOTFOUND|getaddrinfo/i.test(texte)) {
      return Response.json(
        { error: "Nom d'hôte inconnu : vérifiez l'adresse du routeur." },
        { status: 502 });
    }
    if (/ECONNREFUSED|refused/i.test(texte)) {
      return Response.json({
        error: "Rien ne répond sur cette adresse : machine arrêtée " +
          "ou mauvais port REST (voir « quickchr inspect »).",
      }, { status: 502 });
    }
    if (/timed out|ETIMEDOUT|aborted|Timeout/i.test(texte)) {
      return Response.json(
        { error: "Délai dépassé : le routeur ne répond pas à temps." },
        { status: 504 });
    }
    if (/SSL|TLS|wrong version|certificate|ERR_SSL/i.test(texte)) {
      return Response.json({
        error: "Échec TLS : ce routeur expose son API en HTTP simple " +
          "(labo local/CHR). Ressaisissez l'URL en http://. " +
          "Gardez https:// pour un routeur distant.",
      }, { status: 502 });
    }
    return Response.json({ error: "Echec du test de connexion." },
      { status: 500 });
  }

  try {
    const { rows: doublons } = await db.query(
      "SELECT id FROM routeurs WHERE url_base = $1 AND tenant_id = $2",
      [urlBase, tenantId]);
    if (doublons.length > 0) {
      return Response.json({ error: "Routeur deja enregistre." },
        { status: 409 });
    }
    const { rows } = await db.query(
      "INSERT INTO routeurs (nom, url_base, tenant_id) VALUES ($1,$2,$3) " +
        "RETURNING id, nom, url_base",
      [nom, urlBase, tenantId]);
    return Response.json({ data: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("[routeurs]", e);
    return Response.json({ error: "Echec de l'inscription." },
      { status: 500 });
  }
}
