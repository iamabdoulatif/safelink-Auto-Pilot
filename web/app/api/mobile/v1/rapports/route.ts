import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";

// Derniers rapports des ventes envoyés (mobile).
export async function GET() {
  try {
    const ctx = await session();
    const { rows } = await db.query(
      `SELECT e.rapport_id, r.nom AS routeur_nom,
         e.periode_debut::text AS debut, e.periode_fin::text AS fin,
         e.canal, e.statut, e.total_vendu, e.tickets_vendus, e.envoye_le
       FROM rapports_ventes_envois e
       JOIN configurations_routeurs r
         ON r.id = e.router_connection_id AND r.tenant_id = e.tenant_id
       WHERE e.tenant_id = $1 ORDER BY e.created_at DESC LIMIT 20`,
      [ctx.tenantId],
    );
    return Response.json({ data: { rapports: rows } });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
