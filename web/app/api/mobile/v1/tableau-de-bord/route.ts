import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";

// Tableau de bord mobile : compteurs de l'espace en un appel.
export async function GET() {
  try {
    const ctx = await session();
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM configurations_routeurs
          WHERE tenant_id = $1) AS routeurs,
         (SELECT COUNT(*) FROM zones_wifi_destinataires
          WHERE tenant_id = $1) AS zones,
         (SELECT COUNT(*) FROM auto_replenishment_settings
          WHERE tenant_id = $1 AND actif = true) AS regles_actives,
         (SELECT COALESCE(SUM(dernier_stock), 0)
          FROM auto_replenishment_settings WHERE tenant_id = $1) AS stock_total,
         (SELECT COALESCE(SUM(quantite_creee), 0)
          FROM ticket_generation_runs
          WHERE tenant_id = $1 AND created_at > now() - interval '30 days'
            AND simulation = false) AS tickets_30j`,
      [ctx.tenantId],
    );
    const l = (rows as Record<string, unknown>[])[0] ?? {};
    const nombre = (v: unknown) => Number(v ?? 0);
    return Response.json({
      data: {
        routeurs: nombre(l["routeurs"]),
        zones: nombre(l["zones"]),
        reglesActives: nombre(l["regles_actives"]),
        stockTotal: nombre(l["stock_total"]),
        ticketsGeneres30j: nombre(l["tickets_30j"]),
      },
    });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
