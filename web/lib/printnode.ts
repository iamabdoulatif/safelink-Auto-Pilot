import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { assurerEspace, verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { chiffrer, dechiffrer } from "@/lib/chiffrement-serveur";

// Configuration PrintNode par espace : cle API chiffree, imprimante
// cible, format papier, activation. L'envoi du PDF est realise par le
// workflow n8n ; ici : validation, test reel (liste des imprimantes) et
// lecture masquee. Impression automatique refusee tant que le statut
// n'est pas « en-ligne ». Cle jamais reafficher ni journalisee.
export const FORMATS_PAPIER = ["A4", "A5", "Letter"] as const;

// Webhook PrintNode : l'application le cree automatiquement aupres de
// PrintNode (POST /webhook) avec ces trois parametres — url cible,
// secret partage, types de messages. Seul « print job state » est
// demande : l'etat des impressions (envoye, imprime, erreur).
export const CHEMIN_WEBHOOK_PRINTNODE = "/api/printnode/webhook";
export const MESSAGES_WEBHOOK_PRINTNODE = ["print job state"] as const;

// URL publique que PrintNode doit appeler, derivee de APP_URL.
// Null si APP_URL est absente ou invalide (webhook alors impossible).
export function construireUrlWebhookPrintNode(appUrl: string): string | null {
  const base = appUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]+/i.test(base)) return null;
  return base + CHEMIN_WEBHOOK_PRINTNODE;
}

export type ConfigPrintNode = {
  cleConfiguree: boolean; // « configuré » ou « absent », jamais la valeur
  printerId: number | null;
  nomImprimante: string | null;
  formatPapier: string;
  actif: boolean;
  statutConnexion: string;
  dernierTestLe: string | null;
  webhookConfigure: boolean; // webhook cree chez PrintNode
  webhookId: number | null;
  webhookUrl: string; // URL cible publique (jamais le secret)
};

type Ligne = {
  cle_chiffre: string | null;
  printer_id: number | null;
  nom_imprimante: string | null;
  format_papier: string;
  actif: boolean;
  statut_connexion: string;
  dernier_test_le: string | null;
  secret_webhook_chiffre: string | null;
  webhook_id: string | number | null; // bigint renvoye en texte par pg
};

function versConfig(l: Ligne): ConfigPrintNode {
  const webhookId =
    l.webhook_id === null ? null : Number(l.webhook_id);
  return {
    cleConfiguree: !!l.cle_chiffre,
    printerId: l.printer_id,
    nomImprimante: l.nom_imprimante,
    formatPapier: l.format_papier,
    actif: l.actif,
    statutConnexion: l.statut_connexion,
    dernierTestLe: l.dernier_test_le,
    webhookConfigure: webhookId !== null && Number.isInteger(webhookId),
    webhookId:
      webhookId !== null && Number.isInteger(webhookId) ? webhookId : null,
    webhookUrl:
      construireUrlWebhookPrintNode(process.env.APP_URL ?? "") ?? "",
  };
}

// Valide la forme, sans toucher au reseau.
export function validerEntreePrintNode(
  cle: string,
  printerId: number,
  nom: string,
  format: string,
): string | null {
  if (!Number.isInteger(printerId) || printerId <= 0) {
    return "Identifiant d'imprimante invalide (entier positif).";
  }
  if (cle.length > 256) {
    return "Clé API trop longue (256 caractères maximum).";
  }
  if (nom.length > 128) {
    return "Nom d'imprimante trop long (128 caractères maximum).";
  }
  if (!(FORMATS_PAPIER as readonly string[]).includes(format)) {
    return "Format papier inconnu : A4, A5 ou Letter.";
  }
  return null;
}

type ImprimanteDistante = { id?: unknown; name?: unknown };

// Teste la cle COTE SERVEUR : liste les imprimantes du compte et
// retrouve l'identifiant demande (le nom est memorise).
export async function testerImprimante(
  cle: string,
  printerId: number,
): Promise<{ nom: string } | { erreur: string }> {
  let reponse: Response;
  try {
    reponse = await fetch("https://api.printnode.com/printers", {
      method: "GET",
      headers: {
        // Cle API en identifiant Basic, mot de passe vide (API PrintNode).
        Authorization: "Basic " + Buffer.from(cle + ":").toString("base64"),
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { erreur: "PrintNode injoignable." };
  }
  if (reponse.status === 401 || reponse.status === 403) {
    return { erreur: "Clé API PrintNode refusée." };
  }
  if (!reponse.ok) {
    return { erreur: "PrintNode répond en erreur (HTTP " + reponse.status + ")." };
  }
  let liste: unknown;
  try {
    liste = await reponse.json();
  } catch {
    return { erreur: "Réponse PrintNode illisible." };
  }
  const trouve = (Array.isArray(liste) ? liste : []).find(
    (p): p is ImprimanteDistante =>
      typeof p === "object" && p !== null &&
      (p as ImprimanteDistante).id === printerId,
  );
  if (!trouve) {
    return { erreur: "Imprimante introuvable sur ce compte PrintNode." };
  }
  return {
    nom: typeof trouve.name === "string" && trouve.name ? trouve.name : "imprimante " + printerId,
  };
}

type WebhookDistant = { webhookId?: unknown; url?: unknown };

// Cree le webhook chez PrintNode (POST /webhook) ou le met a jour
// (PATCH /webhook/{id}) s'il existe deja : jamais de doublon, PrintNode
// limite a cinq webhooks par compte. Parametres : url cible, secret,
// messages (« print job state »). Reponse : la liste des webhooks du
// compte ; on y retrouve le notre par son URL.
async function creerOuMajWebhook(
  cle: string,
  urlCible: string,
  secret: string,
  webhookIdExistant: number | null,
): Promise<{ webhookId: number } | { erreur: string }> {
  const enTetes = {
    Authorization: "Basic " + Buffer.from(cle + ":").toString("base64"),
    "Content-Type": "application/json",
  };
  const corps = JSON.stringify({
    url: urlCible,
    secret,
    messages: [...MESSAGES_WEBHOOK_PRINTNODE],
  });
  async function appel(methode: string, chemin: string): Promise<Response> {
    return fetch("https://api.printnode.com" + chemin, {
      method: methode,
      headers: enTetes,
      body: corps,
      signal: AbortSignal.timeout(15000),
    });
  }
  let reponse: Response;
  try {
    reponse =
      webhookIdExistant !== null
        ? await appel("PATCH", "/webhook/" + webhookIdExistant)
        : await appel("POST", "/webhook");
    if (webhookIdExistant !== null && reponse.status === 404) {
      reponse = await appel("POST", "/webhook");
    }
  } catch {
    return { erreur: "PrintNode injoignable (webhook)." };
  }
  if (reponse.status === 401 || reponse.status === 403) {
    return { erreur: "Clé API PrintNode refusée (webhook)." };
  }
  if (!reponse.ok) {
    return {
      erreur: "Création du webhook PrintNode en erreur (HTTP " +
        reponse.status + ").",
    };
  }
  let liste: unknown;
  try {
    liste = await reponse.json();
  } catch {
    return { erreur: "Réponse PrintNode illisible (webhook)." };
  }
  const webhooks = (Array.isArray(liste) ? liste : []) as WebhookDistant[];
  const notre =
    webhooks.find((w) => w.url === urlCible) ?? webhooks[0];
  const id = notre ? Number(notre.webhookId) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return { erreur: "Réponse PrintNode illisible (webhook)." };
  }
  return { webhookId: id };
}

// Lit la configuration de l'espace (cle jamais exposee).
export async function lireConfigPrintNode(
  ctx: ContexteTenant,
): Promise<ConfigPrintNode | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT cle_chiffre, printer_id, nom_imprimante, format_papier, actif,
       statut_connexion, dernier_test_le, secret_webhook_chiffre, webhook_id
     FROM configurations_printnode WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const lignes = rows as Ligne[];
  return lignes.length === 0 ? null : versConfig(lignes[0]);
}

// Enregistre (ou remplace) la configuration, cle chiffree.
export async function enregistrerConfigPrintNode(
  ctx: ContexteTenant,
  cle: string,
  printerId: number,
  nom: string,
  format: string,
  actif: boolean,
): Promise<{ config: ConfigPrintNode } | { erreur: string }> {
  verifierContexte(ctx);
  const invalide = validerEntreePrintNode(cle, printerId, nom, format);
  if (invalide) return { erreur: invalide };
  if (!cle) return { erreur: "Clé API PrintNode obligatoire." };
  let nomVerifie: string;
  try {
    const teste = await testerImprimante(cle, printerId);
    if ("erreur" in teste) return teste;
    nomVerifie = nom.trim() || teste.nom;
  } catch {
    return { erreur: "Test PrintNode impossible." };
  }
  // Webhook : URL cible derivee de APP_URL (adresse publique).
  const urlCible = construireUrlWebhookPrintNode(
    process.env.APP_URL ?? "",
  );
  if (!urlCible) {
    return {
      erreur:
        "APP_URL manquante ou invalide : adresse publique (https) " +
        "de l'application requise pour le webhook PrintNode.",
    };
  }
  await assurerEspace(ctx);
  // Secret stable par espace : genere une seule fois, reutilise ensuite
  // (les evenements deja en file chez PrintNode gardent l'ancien secret).
  const { rows: avant } = await db.query(
    `SELECT secret_webhook_chiffre, webhook_id
     FROM configurations_printnode WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const existante = (avant as {
    secret_webhook_chiffre: string | null;
    webhook_id: string | number | null;
  }[])[0];
  let secret = "";
  if (existante?.secret_webhook_chiffre) {
    try {
      secret = dechiffrer(existante.secret_webhook_chiffre);
    } catch {
      secret = "";
    }
  }
  if (!secret) secret = randomBytes(24).toString("hex");
  const webhookIdExistant =
    existante?.webhook_id != null && Number.isInteger(Number(existante.webhook_id))
      ? Number(existante.webhook_id)
      : null;
  const webhook = await creerOuMajWebhook(
    cle, urlCible, secret, webhookIdExistant);
  if ("erreur" in webhook) return webhook;
  const { rows } = await db.query(
    `INSERT INTO configurations_printnode
       (tenant_id, utilisateur_id, cle_chiffre, printer_id, nom_imprimante,
        format_papier, actif, statut_connexion, dernier_test_le,
        secret_webhook_chiffre, webhook_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'en-ligne',now(),$8,$9,now())
     ON CONFLICT (tenant_id) DO UPDATE
     SET utilisateur_id=$2, cle_chiffre=$3, printer_id=$4,
         nom_imprimante=$5, format_papier=$6, actif=$7,
         statut_connexion='en-ligne', dernier_test_le=now(),
         secret_webhook_chiffre=$8, webhook_id=$9, updated_at=now()
     RETURNING cle_chiffre, printer_id, nom_imprimante, format_papier,
       actif, statut_connexion, dernier_test_le, secret_webhook_chiffre,
       webhook_id`,
    [
      ctx.tenantId,
      ctx.utilisateurId,
      chiffrer(cle),
      printerId,
      nomVerifie,
      format,
      actif,
      chiffrer(secret),
      webhook.webhookId,
    ],
  );
  return { config: versConfig((rows as Ligne[])[0]) };
}

// Lit la cle dechiffree (serveur uniquement, pour l'appel n8n signe).
export async function lireClePrintNode(
  ctx: ContexteTenant,
): Promise<string | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    "SELECT cle_chiffre FROM configurations_printnode WHERE tenant_id=$1",
    [ctx.tenantId],
  );
  const lignes = rows as { cle_chiffre: string | null }[];
  if (lignes.length === 0 || !lignes[0].cle_chiffre) return null;
  try {
    return dechiffrer(lignes[0].cle_chiffre);
  } catch {
    return null;
  }
}
