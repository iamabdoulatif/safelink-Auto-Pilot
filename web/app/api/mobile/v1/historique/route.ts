import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";

// Dernières générations de l'espace (mobile), sans aucun secret.
export async function GET() {
  try {
    const ctx = await session();
    const { rows } = await db.query(
      `SELECT run_id, profil, quantite_demandee, quantite_creee,
         stock_avant, stock_apres, canal_envoi, statut, simulation,
         created_at
       FROM ticket_generation_runs
       WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [ctx.tenantId],
    );
    return Response.json({ data: { generations: rows } });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
