import { db } from "@/lib/db";
import { verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";

// Inventaire du parc (table routeurs) : renommer un routeur surveille et
// retirer un routeur du parc. Ne touche jamais au routeur lui-meme : seul
// RouterOS cree/desactive ses objets. Isolation stricte par tenant.
export type EntreeParc = {
  nom: string;
  urlBase: string;
};

export function validerEntreeParc(entree: EntreeParc): string | null {
  const nom = entree.nom.trim();
  if (!nom || nom.length > 100) {
    return "Nom obligatoire (1 à 100 caractères).";
  }
  const urlBase = entree.urlBase.trim();
  if (!urlBase || urlBase.length > 200) {
    return "URL de base obligatoire (1 à 200 caractères).";
  }
  if (!/^https?:\/\//i.test(urlBase)) {
    return "URL de base invalide (« http:// » ou « https:// » attendu).";
  }
  return null;
}

// Renomme un routeur du parc (nom et URL affiches). Le modele et la
// version restent renseignes par la collecte, jamais a la main.
export async function modifierRouteurParc(
  ctx: ContexteTenant,
  id: number,
  entree: EntreeParc,
): Promise<{ ok: true } | { erreur: string }> {
  verifierContexte(ctx);
  const invalide = validerEntreeParc(entree);
  if (invalide) return { erreur: invalide };
  const { rowCount } = await db.query(
    "UPDATE routeurs SET nom=$1, url_base=$2, updated_at=now() " +
      "WHERE id=$3 AND tenant_id=$4",
    [entree.nom.trim(), entree.urlBase.trim(), id, ctx.tenantId],
  );
  if ((rowCount ?? 0) === 0) return { erreur: "Routeur introuvable." };
  return { ok: true };
}

// Retire un routeur du parc (suppression locale, routeur intact).
// Refusee tant que des regles de reapprovisionnement le referencent :
// leurs seuils disparaitraient en cascade avec lui.
export async function supprimerRouteurParc(
  ctx: ContexteTenant,
  id: number,
): Promise<{ ok: true } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows } = await db.query<{ total: string }>(
    "SELECT count(*) AS total FROM abonnements_tickets a " +
      "JOIN routeurs r ON r.id = a.routeur_id " +
      "WHERE a.routeur_id = $1 AND r.tenant_id = $2",
    [id, ctx.tenantId],
  );
  if (Number(rows[0]?.total ?? 0) > 0) {
    return {
      erreur:
        "Suppression impossible : des règles de réapprovisionnement " +
        "référencent encore ce routeur. Désactivez-les d'abord dans " +
        "« Réapprovisionnement automatique ».",
    };
  }
  const { rowCount } = await db.query(
    "DELETE FROM routeurs WHERE id=$1 AND tenant_id=$2",
    [id, ctx.tenantId],
  );
  if ((rowCount ?? 0) === 0) return { erreur: "Routeur introuvable." };
  return { ok: true };
}
