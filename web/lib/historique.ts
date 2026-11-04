import { db } from "@/lib/db";
import { verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";

// Historique des generations : runs + lots du meme espace, sans aucun
// secret (ni mot de passe Mikhmon/RouterOS/tickets, ni jeton, ni cle).
// Le lot rejoint le run par la cle d'idempotence (= runId).
export type LigneHistorique = {
  runId: string;
  routeur: string | null;
  profil: string;
  stockAvant: number | null;
  seuil: number | null;
  quantiteDemandee: number;
  quantiteCreee: number;
  canal: string;
  destinataire: string | null;
  statut: string;
  erreur: string | null;
  debutLe: string;
  finLe: string | null;
};

type Ligne = {
  run_id: string;
  routeur_nom: string | null;
  profil: string;
  stock_avant: number | null;
  seuil: number | null;
  quantite_demandee: number;
  quantite_creee_run: number;
  quantite_creee_lot: number | null;
  canal_envoi: string;
  destinataire: string | null;
  statut: string;
  erreur: string | null;
  debut_le: string;
  fin_le: string | null;
};

export async function listerHistorique(
  ctx: ContexteTenant,
  limite: number,
): Promise<LigneHistorique[]> {
  verifierContexte(ctx);
  const n = Number.isInteger(limite) && limite > 0 && limite <= 200
    ? Math.floor(limite)
    : 50;
  const { rows } = await db.query(
    `SELECT r.run_id, r.profil, r.stock_avant, r.seuil,
       r.quantite_demandee, r.quantite_creee AS quantite_creee_run,
       l.quantite_creee AS quantite_creee_lot, r.canal_envoi,
       COALESCE(r.destinataire, l.destinataire) AS destinataire,
       r.statut, r.erreur, r.created_at AS debut_le,
       r.termine_le AS fin_le,
       COALESCE(cr.nom, r.mikhmon_connection_id::text) AS routeur_nom
     FROM ticket_generation_runs r
     LEFT JOIN lots_tickets l
       ON l.cle_idempotence = r.run_id AND l.tenant_id = r.tenant_id
     LEFT JOIN configurations_routeurs cr
       ON cr.id = r.router_connection_id AND cr.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1
     ORDER BY r.created_at DESC LIMIT ` + n,
    [ctx.tenantId],
  );
  return (rows as Ligne[]).map((l) => ({
    runId: l.run_id,
    routeur: l.routeur_nom,
    profil: l.profil,
    stockAvant: l.stock_avant,
    seuil: l.seuil,
    quantiteDemandee: l.quantite_demandee,
    quantiteCreee: l.quantite_creee_lot ?? l.quantite_creee_run,
    canal: l.canal_envoi,
    destinataire: l.destinataire,
    statut: l.statut,
    erreur: l.erreur,
    debutLe: l.debut_le,
    finLe: l.fin_le,
  }));
}
