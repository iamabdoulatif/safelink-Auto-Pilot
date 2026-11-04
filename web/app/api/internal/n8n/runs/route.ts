import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";

// n8n accepte un job : passage en cours avec le stock constate.
// x-run-id doit egaler corps.runId. Rejouer la meme acceptation est
// sans effet (idempotence sur le runId).
export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const corps = controle.appel.corps;
  const runId = typeof corps["runId"] === "string" ? corps["runId"] : "";
  if (!runId || runId !== controle.appel.runId) {
    return Response.json({ error: "runId incohérent." }, { status: 400 });
  }
  const stockAvant =
    Number.isInteger(corps["stockAvant"]) &&
    (corps["stockAvant"] as number) >= 0
      ? (corps["stockAvant"] as number)
      : null;

  try {
    const { rows } = await db.query(
      `SELECT run_id, statut FROM ticket_generation_runs WHERE run_id = $1`,
      [runId],
    );
    const lignes = rows as { run_id: string; statut: string }[];
    if (lignes.length === 0) {
      return Response.json({ error: "Run inconnu." }, { status: 404 });
    }
    if (lignes[0].statut === "termine" || lignes[0].statut === "echoue") {
      return Response.json({ data: { deja_traite: true } });
    }
    await db.query(
      `UPDATE ticket_generation_runs
       SET statut = 'en_cours', stock_avant = COALESCE(stock_avant, $2),
           demarre_le = COALESCE(demarre_le, now())
       WHERE run_id = $1`,
      [runId, stockAvant],
    );
    return Response.json({ data: { runId, statut: "en_cours" } });
  } catch {
    return Response.json({ error: "Acceptation impossible." },
      { status: 500 });
  }
}
