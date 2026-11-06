import { db } from "@/lib/db";
import { clesModele, extraireCodeModele } from "@/lib/modele-mikrotik";

// Catalogue d'images officielles MikroTik, alimenté par
// scripts/importer-images-mikrotik.mjs depuis mikrotik.com. Les
// photographies restent la propriété de MikroTik ; la source de
// chaque image (url_source, url_page) est conservée en base.
export type ImageMikrotik = {
  id: number;
  nomProduit: string;
  typeMime: string;
};

// Première photographie du produit correspondant au modèle lu sur
// RouterOS. Le code produit (entre parenthèses) prime, puis le nom
// normalisé ou le slug.
export async function imagePourModele(
  modele: string | null | undefined,
): Promise<ImageMikrotik | null> {
  if (!modele?.trim()) return null;
  const code = extraireCodeModele(modele)?.toLowerCase() ?? null;
  const cles = clesModele(modele);
  if (!code && cles.length === 0) return null;
  const { rows } = await db.query<{
    id: string;
    nom_produit: string;
    type_mime: string;
  }>(
    `SELECT id, nom_produit, type_mime
     FROM images_mikrotik
     WHERE ($1::text IS NOT NULL AND code_produit IS NOT NULL
              AND lower(code_produit) = $1)
        OR cle_nom = ANY($2::text[])
        OR slug = ANY($2::text[])
     ORDER BY
       CASE WHEN $1::text IS NOT NULL AND code_produit IS NOT NULL
                  AND lower(code_produit) = $1 THEN 0 ELSE 1 END,
       position, id
     LIMIT 1`,
    [code, cles],
  );
  if (rows.length === 0) return null;
  return {
    id: Number(rows[0].id),
    nomProduit: rows[0].nom_produit,
    typeMime: rows[0].type_mime,
  };
}

// Contenu binaire d'une image du catalogue, pour la route publique.
export async function lireImageMikrotik(
  id: number,
): Promise<{ donnees: Buffer; typeMime: string } | null> {
  const { rows } = await db.query<{ donnees: Buffer; type_mime: string }>(
    `SELECT donnees, type_mime FROM images_mikrotik WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  return { donnees: rows[0].donnees, typeMime: rows[0].type_mime };
}
