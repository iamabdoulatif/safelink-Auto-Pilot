import { db } from "@/lib/db";

// Socle commun des acces donnees : isolation par espace (tenant).
// Chaque requete des DAO filtre sur tenant_id avec le contexte ci-dessous :
// un utilisateur ne voit jamais les installations, routeurs ni bots d'un
// autre espace. Ce module ne cree pas de pool : l'unique pool vit dans
// db.ts, ici on ajoute seulement des garde-fous.

// Contexte d'appel, construit cote serveur (voir lib/session.ts).
export type ContexteTenant = {
  tenantId: string;
  utilisateurId: string;
};

// Refuse un contexte vide : une requete sans tenant ne part jamais.
export function verifierContexte(ctx: ContexteTenant): void {
  if (!ctx.tenantId || !ctx.utilisateurId) {
    throw new Error("Contexte utilisateur manquant : accès refusé.");
  }
}

// Cree l'espace du tenant s'il n'existe pas (premiere visite).
// ON CONFLICT DO NOTHING : rejouable sans doublon.
export async function assurerEspace(ctx: ContexteTenant): Promise<void> {
  verifierContexte(ctx);
  await db.query(
    `INSERT INTO espaces (tenant_id, utilisateur_id)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [ctx.tenantId, ctx.utilisateurId],
  );
}
