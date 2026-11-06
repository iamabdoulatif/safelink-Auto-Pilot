import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";

// Compte rendu de n8n : 1. HMAC, 2. runId connu, 3. idempotence,
// 4. statut + quantite reelle + erreur, 5. reponse rapide.
// Les mots de passe des tickets ne transitent jamais ici : seul le
// NOMBRE de tickets crees est stocke. Apres un succes, la regle est
// desarmee (hysteresis) jusqu'au repassage du stock au-dessus du seuil.
export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const corps = controle.appel.corps;
  // Les anciennes versions du workflow signent l'identifiant sous
  // `cleIdempotence`; accepter cet alias conserve la compatibilité sans
  // desserrer la vérification : la valeur doit toujours égaler x-run-id.
  const runId = typeof corps["runId"] === "string"
    ? corps["runId"]
    : typeof corps["cleIdempotence"] === "string"
      ? corps["cleIdempotence"]
      : "";
  if (!runId || runId !== controle.appel.runId) {
    return Response.json({ error: "runId incohérent." }, { status: 400 });
  }
  const tenantId =
    typeof corps["tenantId"] === "string" ? corps["tenantId"] : "";
  if (!tenantId) {
    return Response.json({ error: "tenantId obligatoire." }, { status: 400 });
  }
  const termine = corps["statut"] === "termine";
  const quantite =
    Number.isInteger(corps["quantiteCreee"]) &&
    (corps["quantiteCreee"] as number) >= 0
      ? (corps["quantiteCreee"] as number)
      : 0;
  const stockAvant = Number.isInteger(corps["stockAvant"])
    ? (corps["stockAvant"] as number)
    : null;
  const stockApres = Number.isInteger(corps["stockApres"])
    ? (corps["stockApres"] as number)
    : null;
  const erreur =
    !termine && typeof corps["erreur"] === "string"
      ? corps["erreur"].slice(0, 500)
      : null;
  // Lot reussi, mais un autre destinataire n'a pas recu le PDF.
  const avertissement =
    termine && typeof corps["avertissement"] === "string"
      ? corps["avertissement"].slice(0, 500)
      : null;

  try {
    const { rows } = await db.query(
      `SELECT run_id, tenant_id, statut, seuil, router_connection_id,
         profil, simulation FROM ticket_generation_runs WHERE run_id = $1`,
      [runId],
    );
    const lignes = rows as {
      run_id: string; tenant_id: string; statut: string;
      seuil: number | null; router_connection_id: number | null;
      profil: string; simulation: boolean;
    }[];
    if (lignes.length === 0 || lignes[0].tenant_id !== tenantId) {
      return Response.json({ error: "Run inconnu." }, { status: 404 });
    }
    const run = lignes[0];
    if (run.statut === "termine" || run.statut === "echoue") {
      return Response.json({ data: { deja_traite: true } });
    }
    await db.query(
      `INSERT INTO webhooks_recus (source, cle_unique)
       VALUES ('n8n', $1) ON CONFLICT (source, cle_unique) DO NOTHING`,
      [runId],
    );
    await db.query(
      `UPDATE ticket_generation_runs
       SET statut = $2, quantite_creee = $3,
           stock_avant = COALESCE(stock_avant, $4), stock_apres = $5,
           erreur = $6, termine_le = now()
       WHERE run_id = $1`,
      [runId, termine ? "termine" : "echoue", quantite,
        stockAvant, stockApres, erreur],
    );
    const lotsVendeurs = Array.isArray(corps["lotsVendeurs"])
      ? (corps["lotsVendeurs"] as { numero?: unknown; lot?: unknown }[])
      : [];
    if (termine && run.router_connection_id !== null) {
      for (const lv of lotsVendeurs) {
        if (typeof lv.numero === "string" && Number.isInteger(lv.lot)) {
          await db.query(
            `INSERT INTO lots_vendeurs
               (tenant_id, router_connection_id, lot, numero_vendeur)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (tenant_id, router_connection_id, lot)
             DO UPDATE SET numero_vendeur = EXCLUDED.numero_vendeur,
               cree_le = CURRENT_DATE`,
            [tenantId, run.router_connection_id, lv.lot, lv.numero],
          );
        }
      }
    }
    if (run.router_connection_id !== null) {
      if (run.simulation && termine) {
        // Simulation reussie de bout en bout : condition d'activation.
        await db.query(
          `UPDATE auto_replenishment_settings
           SET simulation_reussie = true, dernier_stock = $3,
               derniere_verif_le = now(), updated_at = now()
           WHERE tenant_id = $1 AND router_connection_id = $2
             AND profil = $4`,
          [tenantId, run.router_connection_id, stockApres, run.profil],
        );
      } else if (termine && stockApres !== null) {
        // Succes : desarmer jusqu'au repassage au-dessus du seuil.
        await db.query(
          `UPDATE auto_replenishment_settings
           SET dernier_stock = $3, derniere_verif_le = now(),
               stock_rearme = ($3 > seuil), updated_at = now(),
               derniere_erreur = $5
           WHERE tenant_id = $1 AND router_connection_id = $2
             AND profil = $4`,
          [tenantId, run.router_connection_id, stockApres, run.profil, avertissement],
        );
      } else {
        await db.query(
          `UPDATE auto_replenishment_settings
           SET derniere_erreur = $3, derniere_verif_le = now(),
               updated_at = now()
           WHERE tenant_id = $1 AND router_connection_id = $2
             AND profil = $4`,
          [tenantId, run.router_connection_id, erreur, run.profil],
        );
      }
    }
    return Response.json({
      data: { runId, statut: termine ? "termine" : "echoue" },
    });
  } catch {
    return Response.json({ error: "Echec du traitement." }, { status: 500 });
  }
}
