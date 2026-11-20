import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";

// Zones à relever pour le suivi des ventes : à chaque cycle de
// 15 minutes, le workflow demande les zones dont le rapport est
// actif, lit les tickets utilisés sur RouterOS, puis renvoie les
// empreintes des tickets jamais vus (voir ../enregistrer).
export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  if (controle.appel.corps["suiviVentes"] !== true) {
    return Response.json({ error: "Demande de suivi invalide." },
      { status: 400 });
  }
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT z.tenant_id, z.router_connection_id
       FROM zones_wifi_destinataires z
       WHERE z.rapport_actif = true
       ORDER BY z.tenant_id, z.router_connection_id`,
    );
    const zones = (rows as {
      tenant_id: string; router_connection_id: number;
    }[]).map((z) => ({
      tenantId: z.tenant_id,
      routerConnectionId: Number(z.router_connection_id),
    }));
    return Response.json({ data: { zones } });
  } catch {
    return Response.json({ error: "Lecture des zones impossible." },
      { status: 500 });
  }
}
