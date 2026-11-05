import { db } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import { extraireMateriel } from "@/lib/extraire-materiel";
import type { Materiel } from "@/lib/extraire-materiel";
import { rosAvecIdentifiants } from "@/lib/routeros";

// Lit le materiel en direct avec le compte de lecture de l'espace. Le modele
// et la version sont gardes en base pour rester affiches si le routeur tombe.
export async function lireMaterielRouteur(
  tenantId: string,
  routeurId: number,
  urlBase: string,
): Promise<Materiel | null> {
  const { rows } = await db.query<{
    utilisateur_lecture: string | null;
    mot_de_passe_lecture_chiffre: string | null;
  }>(
    `SELECT utilisateur_lecture, mot_de_passe_lecture_chiffre
     FROM configurations_routeurs
     WHERE tenant_id = $1 AND adresse_routeros = $2 AND actif`,
    [tenantId, urlBase],
  );
  const compte = rows[0];
  if (!compte?.utilisateur_lecture || !compte.mot_de_passe_lecture_chiffre) {
    return null;
  }
  try {
    const ros = rosAvecIdentifiants(
      urlBase,
      compte.utilisateur_lecture,
      dechiffrer(compte.mot_de_passe_lecture_chiffre),
    );
    const [resource, routerboard] = await Promise.all([
      ros.get<Record<string, unknown>>("/system/resource"),
      ros
        .get<Record<string, unknown>>("/system/routerboard")
        .catch(() => null),
    ]);
    const materiel = extraireMateriel(resource, routerboard);
    await db.query(
      `UPDATE routeurs SET modele = $1, version_os = $2, updated_at = now()
       WHERE id = $3 AND tenant_id = $4
         AND (modele IS DISTINCT FROM $1 OR version_os IS DISTINCT FROM $2)`,
      [materiel.modele, materiel.version, routeurId, tenantId],
    );
    return materiel;
  } catch {
    console.error("[materiel-routeur] Lecture impossible, routeur", routeurId);
    return null;
  }
}
