import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";

// Routeurs (zones MikroTik) de l'espace, pour le mobile.
// Aucune adresse interne détaillée ni secret : nom et variante.
export async function GET() {
  try {
    const ctx = await session();
    const { rows } = await db.query(
      `SELECT r.id, r.nom, r.variante_mikhmon,
         z.commune, z.localisation, z.latitude, z.longitude, z.wifi_nom
       FROM configurations_routeurs r
       LEFT JOIN zones_wifi_destinataires z
         ON z.router_connection_id = r.id AND z.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 ORDER BY r.nom`,
      [ctx.tenantId],
    );
    return Response.json({ data: { routeurs: rows } });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
