import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";

// Distribue les jobs de reapprovisionnement a n8n (Schedule Trigger 15 min).
// 1. Signature HMAC + horodatage + anti-rejeu (voir lib/n8n-interne).
// 2. Regles actives uniquement, frequence de verification respectee.
// 3. Routeurs et profils actifs et valides uniquement.
// 4. Aucun run recent en cours sur le meme triplet (verrou logique avec
//    anciennete : une demande abandonnee depuis plus de 30 minutes ou
//    en cours depuis plus de 2 heures ne bloque plus).
// 5. Un runId unique par job, sans aucun mot de passe en retour.
// 6. Regles desarmees (hysteresis) : job de SURVEILLANCE (quantite nulle,
//    sans creation) pour observer le repassage au-dessus du seuil.
type Regle = {
  regle_id: number;
  tenant_id: string;
  utilisateur_id: string;
  router_connection_id: number;
  mikhmon_connection_id: number | null;
  profile_id: number | null;
  profil: string;
  profil_valide: boolean | null;
  routeur_actif: boolean;
  seuil: number;
  quantite_generation: number;
  quantite_cible: number;
  canal: string;
  stock_rearme: boolean;
};

const VERROU_SQL = `SELECT id FROM ticket_generation_runs
  WHERE tenant_id = $1 AND router_connection_id = $2 AND profil = $3
    AND ((statut = 'demande'
      AND created_at > now() - interval '30 minutes')
      OR (statut = 'en_cours'
      AND demarre_le > now() - interval '2 hours'))
  LIMIT 1`;

async function reglesActives(
  surveillance: boolean,
  simulation: boolean,
): Promise<Regle[]> {
  const { rows } = await db.query(
    `SELECT s.id AS regle_id, s.tenant_id, s.utilisateur_id,
       s.router_connection_id, s.mikhmon_connection_id, s.profile_id,
       s.profil, p.valide AS profil_valide, r.actif AS routeur_actif,
       s.seuil, s.quantite_generation, s.quantite_cible, s.canal,
       s.stock_rearme
     FROM auto_replenishment_settings s
     JOIN configurations_routeurs r
       ON r.id = s.router_connection_id AND r.actif = true
     LEFT JOIN hotspot_profiles p ON p.id = s.profile_id
       WHERE ${simulation ? "true" : "s.actif = true"}
       AND s.stock_rearme = ${surveillance ? "false" : "true"}
       AND (s.derniere_verif_le IS NULL
         OR s.derniere_verif_le <
           now() - (s.frequence_minutes || ' minutes')::interval)`,
  );
  return rows as Regle[];
}

export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const simulation = controle.appel.corps["simulation"] === true;

  let regles: Regle[];
  try {
    regles = [
      ...(await reglesActives(false, simulation)),
      ...(simulation ? [] : await reglesActives(true, false)),
    ];
  } catch {
    return Response.json({ error: "Lecture des règles impossible." },
      { status: 500 });
  }

  const jobs: Record<string, unknown>[] = [];
  const ignores: Record<string, unknown>[] = [];
  for (const regle of regles) {
    const base = {
      tenantId: regle.tenant_id,
      routerConnectionId: regle.router_connection_id,
      profil: regle.profil,
    };
    if (!regle.routeur_actif) {
      ignores.push({ ...base, motif: "routeur inactif" });
      continue;
    }
    if (regle.profile_id !== null && regle.profil_valide !== true) {
      ignores.push({ ...base, motif: "profil non validé" });
      continue;
    }
    const enSurveillance = !regle.stock_rearme;
    try {
      const { rows: verrous } = await db.query(VERROU_SQL,
        [regle.tenant_id, regle.router_connection_id, regle.profil]);
      if (verrous.length > 0) {
        ignores.push({ ...base, motif: "run déjà actif" });
        continue;
      }
      const runId = randomUUID();
      const creeLe = new Date().toISOString();
      await db.query(
        `INSERT INTO ticket_generation_runs
           (run_id, tenant_id, utilisateur_id, mikhmon_connection_id,
            router_connection_id, profil, quantite_demandee, seuil,
            quantite_cible, canal_envoi, simulation, statut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [runId, regle.tenant_id, regle.utilisateur_id,
          regle.mikhmon_connection_id, regle.router_connection_id,
          regle.profil, enSurveillance ? 1 : regle.quantite_generation,
          regle.seuil, regle.quantite_cible, regle.canal, simulation,
          simulation ? "simulation" : "demande"],
      );
      await db.query(
        `UPDATE auto_replenishment_settings
         SET derniere_verif_le = now(), updated_at = now()
         WHERE id = $1`,
        [regle.regle_id],
      );
      jobs.push({
        runId,
        userId: regle.utilisateur_id,
        tenantId: regle.tenant_id,
        routerConnectionId: regle.router_connection_id,
        mikhmonConnectionId: regle.mikhmon_connection_id,
        profileId: regle.profile_id,
        threshold: regle.seuil,
        targetQuantity: enSurveillance ? 0 : regle.quantite_generation,
        deliveryChannel: regle.canal,
        statut: simulation ? "simulation" : "demande",
        surveillance: enSurveillance,
        dateCreation: creeLe,
      });
    } catch {
      ignores.push({ ...base, motif: "création du run impossible" });
    }
  }
  return Response.json({ data: { jobs, ignores } });
}
