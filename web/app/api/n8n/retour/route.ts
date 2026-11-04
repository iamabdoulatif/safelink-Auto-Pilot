import { db } from "@/lib/db";
import { verifierBrut } from "@/lib/signature";

// Retour de n8n (« compte rendu ») : signature HMAC du corps brut,
// puis idempotence sur la cle d'execution. Un doublon repond 200
// sans rien refaire. Les mots de passe des tickets ne transitent
// jamais ici : seul le NOMBRE de tickets crees est stocke.
type RetourN8n = {
  tenantId?: unknown;
  cleIdempotence?: unknown;
  runId?: unknown; // alias de cleIdempotence (route /api/generer-tickets)
  statut?: unknown; // "termine" | "echoue" | "en_attente"
  quantiteCreee?: unknown;
  stockAvant?: unknown;
  stockApres?: unknown;
  erreur?: unknown;
  message?: unknown;
  // Approbation dans l'application : l'URL de reprise du node Wait n8n
  // et l'identifiant d'execution n8n (cle d'upsert, un par run n8n).
  urlReprise?: unknown;
  executionId?: unknown;
  workflow?: unknown;
  resume?: unknown; // { profil, quantite, routeur } affiche a l'ecran
};

export async function POST(req: Request) {
  const secret = process.env.N8N_CALLBACK_SECRET ?? "";
  if (!secret) {
    return Response.json({ error: "Retours n8n non configurés." },
      { status: 503 });
  }
  const brut = await req.text();
  const signature = req.headers.get("x-signature") ?? "";
  if (!verifierBrut(secret, brut, signature)) {
    return Response.json({ error: "Signature invalide." }, { status: 401 });
  }

  let corps: RetourN8n;
  try {
    corps = JSON.parse(brut) as RetourN8n;
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const tenantId = typeof corps.tenantId === "string" ? corps.tenantId : "";
  const cle = typeof corps.cleIdempotence === "string"
    ? corps.cleIdempotence
    : typeof corps.runId === "string" ? corps.runId : "";
  if (!tenantId || !cle || cle.length > 128) {
    return Response.json(
      { error: "tenantId et cleIdempotence obligatoires." },
      { status: 400 });
  }

  // Approbation dans l'application : memorise l'URL de reprise (usage
  // unique) sans toucher aux lots — aucun ticket n'existe encore. L'upsert
  // est idempotent par nature : pas de gate webhooks_recus ici, sinon le
  // compte rendu terminal du meme run serait avale en doublon.
  if (corps.statut === "en_attente") {
    const urlReprise = typeof corps.urlReprise === "string"
      ? corps.urlReprise.trim().slice(0, 500)
      : "";
    const executionId = typeof corps.executionId === "string"
      ? corps.executionId.trim().slice(0, 128)
      : "";
    const workflow = typeof corps.workflow === "string" &&
      corps.workflow.trim()
      ? corps.workflow.trim().slice(0, 64)
      : "mikhmon-tickets";
    if (!urlReprise || !/^https?:\/\//i.test(urlReprise) || !executionId) {
      return Response.json(
        { error: "urlReprise (http) et executionId obligatoires." },
        { status: 400 });
    }
    const resume = corps.resume !== null &&
      typeof corps.resume === "object" && !Array.isArray(corps.resume)
      ? corps.resume as Record<string, unknown>
      : null;
    try {
      await db.query(
        `INSERT INTO executions_n8n
           (lot_id, workflow, execution_id, url_reprise, statut,
            tenant_id, charge_utile)
         VALUES (NULL, $1, $2, $3, 'en_attente', $4, $5)
         ON CONFLICT (execution_id) DO UPDATE SET
           statut = 'en_attente',
           url_reprise = EXCLUDED.url_reprise,
           charge_utile = EXCLUDED.charge_utile
         WHERE executions_n8n.statut NOT IN ('termine', 'echoue')`,
        [workflow, executionId, urlReprise, tenantId,
          resume ? JSON.stringify(resume).slice(0, 2000) : null],
      );
      return Response.json({ data: { en_attente: true } });
    } catch (e) {
      console.error("[n8n-retour-attente]", e);
      return Response.json({ error: "Echec de traitement." },
        { status: 500 });
    }
  }

  const termine = corps.statut === "termine";
  const quantite =
    Number.isInteger(corps.quantiteCreee) &&
    (corps.quantiteCreee as number) >= 0
      ? (corps.quantiteCreee as number)
      : 0;
  const stockAvant = Number.isInteger(corps.stockAvant)
    ? (corps.stockAvant as number)
    : null;
  const stockApres = Number.isInteger(corps.stockApres)
    ? (corps.stockApres as number)
    : null;
  const erreurTexte = typeof corps.erreur === "string"
    ? corps.erreur.slice(0, 500)
    : (typeof corps.message === "string"
      ? corps.message.slice(0, 500)
      : null);

  // Memoire anti-doublon : deja vu -> 200 sans rien refaire.
  try {
    const { rowCount } = await db.query(
      `INSERT INTO webhooks_recus (source, cle_unique)
       VALUES ('n8n', $1) ON CONFLICT (source, cle_unique) DO NOTHING`,
      [cle],
    );
    if ((rowCount ?? 0) === 0) {
      return Response.json({ data: { deja_traite: true } });
    }
    await db.query(
      `UPDATE lots_tickets
       SET statut = $3, quantite_creee = $4
       WHERE cle_idempotence = $1 AND tenant_id = $2`,
      [cle, tenantId, termine ? "genere" : "echoue", quantite],
    );
    await db.query(
      `UPDATE executions_n8n SET statut = $3, termine_le = now()
       WHERE lot_id = (SELECT id FROM lots_tickets
         WHERE cle_idempotence = $1 AND tenant_id = $2)
         AND workflow = 'mikhmon-tickets'`,
      [cle, tenantId, termine ? "termine" : "echoue"],
    );
    // Meme cle = runId de /api/generer-tickets : le run suit le meme sort,
    // sans ecraser un etat terminal deja connu. Aucun mot de passe ici :
    // seul le NOMBRE de tickets crees est stocke.
    await db.query(
      `UPDATE ticket_generation_runs
       SET statut = $3, quantite_creee = $4,
           stock_avant = COALESCE(stock_avant, $5),
           stock_apres = $6, erreur = COALESCE(erreur, $7),
           termine_le = COALESCE(termine_le, now())
       WHERE run_id = $1 AND tenant_id = $2 AND statut NOT IN
         ('termine', 'echoue')`,
      [cle, tenantId, termine ? "termine" : "echoue", quantite,
        stockAvant, stockApres, erreurTexte],
    );
    return Response.json({ data: { enregistre: true, statut: termine ? "genere" : "echoue" } });
  } catch (e) {
    console.error("[n8n-retour]", e);
    return Response.json({ error: "Echec du traitement." }, { status: 500 });
  }
}
