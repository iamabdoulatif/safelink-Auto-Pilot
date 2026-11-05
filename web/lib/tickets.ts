import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { canonicaliser } from "@/lib/signature";

// Declenchement de la generation : la route manuelle et la ronde
// automatique passent par ici, avec la meme charge et le meme suivi.
// Contrat n8n a 12 champs : userId, tenantId, mikhmonConnectionId,
// routerConnectionId, profile, threshold, targetQuantity,
// deliveryChannel, telegramChatId, whatsappRecipient,
// printNodePrinterId, runId. Le runId est la cle d'idempotence :
// rejouer le meme runId retrouve le run au lieu d'en creer un.
// Les tickets sont crees dans /ip/hotspot/user : ils apparaissent donc
// dans Mikhmon sans aucune synchronisation. Leurs mots de passe ne sont
// ni stockes en base ni journalises. La charge signee (HMAC) transite
// de serveur a serveur ; aucun secret ne figure dans une URL.
const N8N_BASE = (process.env.N8N_BASE_URL ?? "").replace(/\/$/, "");
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET ?? "";
const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");

export class EchecDeclenchement extends Error {
  constructor(public http: 502 | 503, message: string) { super(message); }
}

// « 500Mo », « 2 Go », « 1024 » (octets) -> nombre entier d'octets.
// Que des entiers : jamais de flottant pour une valeur exacte.
export function parseVolumeOctets(brut: string): number | null {
  const m = /^\s*(\d+)\s*(o|ko|mo|go|to)?\s*$/i.exec(brut);
  if (!m) return null;
  const unite = (m[2] ?? "o").toLowerCase();
  const facteur = { o: 1, ko: 1024, mo: 1048576, go: 1073741824,
    to: 1099511627776 }[unite] ?? 1;
  const valeur = Number(m[1]) * facteur;
  if (!Number.isSafeInteger(valeur) || valeur <= 0) return null;
  return valeur;
}

// Duree RouterOS (limit-uptime) : « 2h », « 30m », « 1d 2h ».
// Vide = illimite.
export function dureeLimiteValide(brut: string): boolean {
  return /^(\d+\s*[smhdw]\s*)+$/i.test(brut) && brut.length <= 32;
}

// Prefixe des identifiants : alphabet lisible, 12 caracteres maximum.
export function prefixeValide(brut: string): boolean {
  return /^[A-Za-z0-9-]{1,12}$/.test(brut);
}

// Canaux geres par le workflow n8n (« Choisir le canal »).
export type CanalLivraison =
  | "interface"
  | "telegram"
  | "whatsapp"
  | "printnode"
  | "pdf";

export const CANAUX_LIVRAISON: readonly CanalLivraison[] = [
  "interface",
  "telegram",
  "whatsapp",
  "printnode",
  "pdf",
];

export type DemandeLot = {
  // Contrat n8n (12 champs) :
  userId: string;
  tenantId: string;
  mikhmonConnectionId: number | null;
  routerConnectionId: number | null;
  profile: string;
  threshold: number;
  targetQuantity: number;
  deliveryChannel: CanalLivraison;
  telegramChatId: string | null;
  whatsappRecipient: string | null;
  printNodePrinterId: string | null;
  runId: string; // cle d'idempotence (rejeu = retrouve, pas recree)
  routeurNom: string | null; // affiche dans les messages (jamais un secret)
  forcerGeneration?: boolean; // manuel valide : saute le portillon de stock
  // Details d'execution resolus cote serveur :
  routeurUrlBase: string;
  routerUser: string;
  routerPassword: string;
  dureeLimite?: string; // ex. "2h", vide = sans limite
  volumeLimiteOctets?: number; // vide = sans limite
  prefixe?: string;
  jetonTelegram?: string; // bot personnalise dechiffre, ou "" (central)
  secretWhatsApp?: string; // dechiffre, ou "" (sans secret)
  clePrintNode?: string; // dechiffre, ou "" (env n8n sinon)
  stockAvant?: number | null;
};

export type ResultatLot = {
  lot_id: number;
  execution_id: number;
  cle_idempotence: string;
  run_existant: boolean; // true = runId deja vu, rien relance
};

// Valide le contrat avant toute ecriture, sans toucher au reseau.
export function validerDemandeLot(d: DemandeLot): string | null {
  if (!d.userId || !d.tenantId) return "Utilisateur ou espace manquant.";
  if (!d.runId.trim() || d.runId.trim().length > 128) {
    return "runId obligatoire (1 à 128 caractères).";
  }
  if (!d.profile.trim() || d.profile.trim().length > 64) {
    return "Profil obligatoire (1 à 64 caractères).";
  }
  if (!Number.isInteger(d.targetQuantity) || d.targetQuantity < 1
    || d.targetQuantity > 500) {
    return "Quantité cible : entier entre 1 et 500.";
  }
  if (!Number.isInteger(d.threshold) || d.threshold < 0) {
    return "Seuil invalide (entier positif ou nul).";
  }
  if (!CANAUX_LIVRAISON.includes(d.deliveryChannel)) {
    return "Canal inconnu.";
  }
  if (d.prefixe && !prefixeValide(d.prefixe)) {
    return "Préfixe invalide (lettres, chiffres, tiret, 12 max).";
  }
  return null;
}

export async function genererLot(d: DemandeLot): Promise<ResultatLot> {
  const invalide = validerDemandeLot(d);
  if (invalide) throw new EchecDeclenchement(503, invalide);
  if (!N8N_BASE) {
    throw new EchecDeclenchement(503,
      "Service n8n non configuré (N8N_BASE_URL).");
  }
  if (!N8N_SECRET) {
    throw new EchecDeclenchement(503,
      "Secret n8n manquant (N8N_WEBHOOK_SECRET) : déclenchement refusé.");
  }

  // 1) Lot applicatif (tracabilite, sans aucun mot de passe de ticket).
  const { rows: lots } = await db.query(
    `INSERT INTO lots_tickets (tenant_id, configuration_routeur_id,
      routeur_id, profil, quantite_demandee, prefixe, canal_envoi,
      destinataire, statut, cle_idempotence, duree_limite,
      volume_limite_octets)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'demande',$9,$10,$11) RETURNING id`,
    [d.tenantId, d.routerConnectionId, null, d.profile, d.targetQuantity,
      d.prefixe || null, d.deliveryChannel,
      d.telegramChatId || d.whatsappRecipient || null,
      d.runId, d.dureeLimite || null, d.volumeLimiteOctets ?? null]);
  const lotId = lots[0].id as number;

  // 2) Run idempotent : meme runId = meme run, jamais de doublon.
  const { rows: runs } = await db.query(
    `INSERT INTO ticket_generation_runs
       (run_id, tenant_id, utilisateur_id, mikhmon_connection_id,
        router_connection_id, profil, quantite_demandee, canal_envoi,
        telegram_chat_id, statut, stock_avant, seuil, quantite_cible,
        destinataire, whatsapp_recipient, printnode_printer_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'demande',$10,$11,$12,$13,$14,$15)
     ON CONFLICT (tenant_id, run_id) DO NOTHING
     RETURNING id`,
    [d.runId, d.tenantId, d.userId, d.mikhmonConnectionId,
      d.routerConnectionId, d.profile, d.targetQuantity,
      d.deliveryChannel, d.telegramChatId,
      d.stockAvant ?? null, d.threshold, d.targetQuantity,
      d.telegramChatId || d.whatsappRecipient || null,
      d.whatsappRecipient, d.printNodePrinterId]);
  if (runs.length === 0) {
    // Run deja vu (rejouage ou double ronde) : on ne relance rien.
    await db.query("UPDATE lots_tickets SET statut='ignore' WHERE id=$1",
      [lotId]);
    return {
      lot_id: lotId, execution_id: 0, cle_idempotence: d.runId,
      run_existant: true,
    };
  }

  // 3) Charge signee vers n8n (serveur a serveur, jamais dans une URL).
  // Nom imprime sur les tickets : nom_ticket, sinon le nom du routeur.
  const { rows: noms } = await db.query(
    `SELECT nom_ticket FROM configurations_routeurs
     WHERE id = $1 AND tenant_id = $2`,
    [d.routerConnectionId, d.tenantId],
  );
  const nomTicket = (noms[0] as { nom_ticket: string | null } | undefined)
    ?.nom_ticket || d.routeurNom || "";

  const charge = {
    userId: d.userId,
    tenantId: d.tenantId,
    mikhmonConnectionId: d.mikhmonConnectionId,
    routerConnectionId: d.routerConnectionId,
    profile: d.profile,
    threshold: d.threshold,
    targetQuantity: d.targetQuantity,
    deliveryChannel: d.deliveryChannel,
    telegramChatId: d.telegramChatId || "",
    whatsappRecipient: d.whatsappRecipient || "",
    printNodePrinterId: d.printNodePrinterId || "",
    runId: d.runId,
    cleIdempotence: d.runId,
    routerBaseUrl: d.routeurUrlBase.replace(/\/$/, ""),
    routerUser: d.routerUser,
    routerPassword: d.routerPassword,
    quantity: d.targetQuantity,
    prefix: d.prefixe || "",
    limitUptime: d.dureeLimite || "",
    limitBytesTotal:
      d.volumeLimiteOctets === undefined ? "" : String(d.volumeLimiteOctets),
    recipient: d.telegramChatId || d.whatsappRecipient || "",
    telegramBotToken: d.jetonTelegram || "",
    whatsappSecret: d.secretWhatsApp || "",
    printNodeApiKey: d.clePrintNode || "",
    routeurNom: d.routeurNom || "",
    nomTicket,
    forcerGeneration: d.forcerGeneration === true,
    callbackUrl: APP_URL ? APP_URL + "/api/n8n/retour" : "",
  };
  const corps = canonicaliser(charge);
  const signature = createHmac("sha256", N8N_SECRET).update(corps).digest("hex");

  let reponse: unknown = null;
  let ok = true;
  try {
    const r = await fetch(N8N_BASE + "/webhook/mikhmon/tickets", {
      method: "POST",
      headers: {
        // Preuve HMAC uniquement : le secret brut ne voyage jamais
        // (ni logs, ni historique d'execution n8n). Le workflow le
        // connait deja via son environnement.
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body: corps,
      signal: AbortSignal.timeout(30000),
    });
    const txt = await r.text();
    try { reponse = txt ? JSON.parse(txt) : null; }
    catch { reponse = txt.slice(0, 500); }
    if (!r.ok) {
      ok = false;
      reponse = { http: r.status, corps: reponse };
    }
  } catch (e) {
    ok = false;
    reponse = { erreur: String(e).slice(0, 500) };
  }

  const { rows: execs } = await db.query(
    `INSERT INTO executions_n8n (tenant_id, lot_id, workflow, statut,
      charge_utile)
     VALUES ($1,$2,'mikhmon-tickets',$3,$4) RETURNING id`,
    [d.tenantId, lotId, ok ? "lance" : "echoue",
      reponse === null ? null : JSON.stringify(reponse)]);
  if (!ok) {
    await db.query("UPDATE lots_tickets SET statut='echoue' WHERE id=$1",
      [lotId]);
    await db.query(
      `UPDATE ticket_generation_runs SET statut='echoue', termine_le=now()
       WHERE run_id=$1 AND tenant_id=$2`,
      [d.runId, d.tenantId]);
    throw new EchecDeclenchement(502,
      "n8n n'a pas accepté la demande (lot " + lotId + ").");
  }
  await db.query("UPDATE lots_tickets SET statut='lance' WHERE id=$1",
    [lotId]);
  await db.query(
    `UPDATE ticket_generation_runs SET statut='lance' WHERE run_id=$1
     AND tenant_id=$2`,
    [d.runId, d.tenantId]);
  return {
    lot_id: lotId,
    execution_id: execs[0].id as number,
    cle_idempotence: d.runId,
    run_existant: false,
  };
}
