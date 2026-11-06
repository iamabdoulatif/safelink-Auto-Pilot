import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";
import { rapportEstDu } from "@/lib/rapports-ventes";
import type { PlanificationRapport } from "@/lib/rapports-ventes";

// Rapports des ventes dus aujourd'hui (cycles de 00h à 00h définis
// dans le dashboard, par zone) : le cycle n8n demande les rapports à
// envoyer, le SaaS ne rend que les zones dues et crée l'envoi
// (unicité zone + période : jamais de double rapport).
export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await db.query(
      `SELECT z.tenant_id, z.router_connection_id, z.rapport_canal,
          z.rapport_planification, z.rapport_debut::text AS debut,
          z.rapport_fin::text AS fin,
          z.rapport_date_envoi::text AS date_envoi,
          r.nom AS routeur_nom
       FROM zones_wifi_destinataires z
       JOIN configurations_routeurs r
         ON r.id = z.router_connection_id AND r.tenant_id = z.tenant_id
       WHERE z.rapport_actif = true`,
    );
    const zones = rows as {
      tenant_id: string; router_connection_id: number;
      rapport_canal: string; rapport_planification: PlanificationRapport;
      debut: string | null; fin: string | null; date_envoi: string | null;
      routeur_nom: string;
    }[];
    const jobs: Record<string, unknown>[] = [];
    for (const zone of zones) {
      const periode = rapportEstDu(
        zone.rapport_planification, aujourdhui,
        zone.debut && zone.fin
          ? { debut: zone.debut, fin: zone.fin, dateEnvoi: zone.date_envoi ?? "" }
          : undefined,
      );
      if (!periode) continue;
      const rapportId = randomUUID();
      const { rowCount } = await db.query(
        `INSERT INTO rapports_ventes_envois
           (rapport_id, tenant_id, router_connection_id, periode_debut,
            periode_fin, canal, statut)
         VALUES ($1,$2,$3,$4,$5,$6,'demande')
         ON CONFLICT (tenant_id, router_connection_id, periode_debut, periode_fin)
         DO NOTHING`,
        [rapportId, zone.tenant_id, zone.router_connection_id,
          periode.debut, periode.fin, zone.rapport_canal],
      );
      if (!rowCount) continue; // déjà créé pour ce cycle
      jobs.push({
        rapportId, tenantId: zone.tenant_id,
        routerConnectionId: zone.router_connection_id,
        routeurNom: zone.routeur_nom,
      });
    }
    return Response.json({ data: { jobs } });
  } catch {
    return Response.json({ error: "Lecture des rapports impossible." },
      { status: 500 });
  }
}
