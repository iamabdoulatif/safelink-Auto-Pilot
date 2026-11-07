import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";

// Règles de réapprovisionnement de l'espace (lecture mobile).
export async function GET() {
  try {
    const ctx = await session();
    const { rows } = await db.query(
      `SELECT s.id, r.nom AS routeur_nom, s.profil, s.seuil,
         s.quantite_generation, s.canal, s.destinataire, s.actif,
         s.dernier_stock, s.derniere_erreur, s.approbation_requise,
         s.approbation_canal
       FROM auto_replenishment_settings s
       JOIN configurations_routeurs r
         ON r.id = s.router_connection_id AND r.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1 ORDER BY r.nom, s.profil`,
      [ctx.tenantId],
    );
    return Response.json({ data: { regles: rows } });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
