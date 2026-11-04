import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { assurerEspace, verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { chiffrer, dechiffrer } from "@/lib/chiffrement-serveur";
import { verifierJetonBot, verifierChatId } from "@/lib/telegram";

// Bots Telegram : un bot central (jeton dans l'environnement) ou un bot
// personnalise par espace (jeton chiffre en base). Le jeton est verifie
// via getMe COTE SERVEUR avant ecriture, refuse s'il est invalide, puis
// n'est JAMAIS reaffiche ni journalise : la lecture expose seulement
// « configuré » ou « absent ». Le webhook est par utilisateur : chaque
// espace possede son secret, verifie a chaque appel entrant.

// Mode du bot de l'espace.
export type ModeBot = "central" | "personnalise";

export type BotTelegram = {
  mode: ModeBot;
  nom: string | null; // nom d'affichage (@bot), mode personnalise
  chatId: string;
  statutConnexion: string;
  dernierTestLe: string | null;
  jetonConfigure: boolean; // « configuré » ou « absent », jamais la valeur
  botVerifie: boolean; // getMe reussi au moins une fois
};

type Ligne = {
  mode: string;
  nom: string | null;
  chat_id: string;
  jeton_chiffre: string | null;
  nom_bot: string | null;
  bot_verifie: boolean;
  statut_connexion: string;
  dernier_test_le: string | null;
};

function versBot(l: Ligne): BotTelegram {
  return {
    mode: l.mode === "personnalise" ? "personnalise" : "central",
    nom: l.nom ?? l.nom_bot,
    chatId: l.chat_id,
    statutConnexion: l.statut_connexion,
    dernierTestLe: l.dernier_test_le,
    jetonConfigure:
      l.mode === "central"
        ? (process.env.TELEGRAM_BOT_TOKEN ?? "").length > 0
        : !!l.jeton_chiffre,
    botVerifie: l.bot_verifie,
  };
}

// Lit la configuration Telegram de l'espace (sans aucun secret).
export async function lireBot(
  ctx: ContexteTenant,
): Promise<BotTelegram | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT mode, nom, chat_id, jeton_chiffre, nom_bot, bot_verifie,
       statut_connexion, dernier_test_le
     FROM configurations_telegram WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const lignes = rows as Ligne[];
  return lignes.length === 0 ? null : versBot(lignes[0]);
}

// Valide un chat ID : chiffres, eventuellement avec le signe moins.
function validerChatId(chatId: string): string | null {
  if (!/^-?\d{1,20}$/.test(chatId.trim())) {
    return "Chat ID invalide (chiffres uniquement).";
  }
  return null;
}

// Enregistre le bot central (chat ID de l'utilisateur, jeton en env).
export async function enregistrerBotCentral(
  ctx: ContexteTenant,
  chatId: string,
): Promise<{ bot: BotTelegram } | { erreur: string }> {
  verifierContexte(ctx);
  const invalide = validerChatId(chatId);
  if (invalide) return { erreur: invalide };
  if (!(process.env.TELEGRAM_BOT_TOKEN ?? "").trim()) {
    return { erreur: "Bot central non configuré côté serveur." };
  }
  try {
    await verifierChatId(
      (process.env.TELEGRAM_BOT_TOKEN as string).trim(), chatId);
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Chat ID refusé." };
  }
  await assurerEspace(ctx);
  const { rows } = await db.query(
    `INSERT INTO configurations_telegram
       (tenant_id, utilisateur_id, mode, chat_id, jeton_chiffre, nom_bot,
        bot_verifie, statut_connexion, updated_at)
     VALUES ($1,$2,'central',$3,NULL,NULL,false,'jamais-teste',now())
     ON CONFLICT (tenant_id) DO UPDATE
     SET utilisateur_id=$2, mode='central', chat_id=$3, jeton_chiffre=NULL,
         nom_bot=NULL, bot_verifie=false, updated_at=now()
     RETURNING mode, nom, chat_id, jeton_chiffre, nom_bot, bot_verifie,
       statut_connexion, dernier_test_le`,
    [ctx.tenantId, ctx.utilisateurId, chatId.trim()],
  );
  return { bot: versBot((rows as Ligne[])[0]) };
}

// Enregistre un bot personnalise : getMe D'ABORD, ecriture ENSUITE.
// Jeton invalide = refuse, rien n'est ecrit.
export async function enregistrerBotPersonnalise(
  ctx: ContexteTenant,
  nom: string,
  jeton: string,
  chatId: string,
): Promise<{ bot: BotTelegram } | { erreur: string }> {
  verifierContexte(ctx);
  if (!nom.trim() || nom.trim().length > 100) {
    return { erreur: "Nom du bot obligatoire (1 à 100 caractères)." };
  }
  const invalide = validerChatId(chatId);
  if (invalide) return { erreur: invalide };
  let verifie: { nom: string };
  try {
    verifie = await verifierJetonBot(jeton);
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Jeton refusé." };
  }
  try {
    await verifierChatId(jeton, chatId);
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Chat ID refusé." };
  }
  await assurerEspace(ctx);
  const { rows } = await db.query(
    `INSERT INTO configurations_telegram
       (tenant_id, utilisateur_id, mode, chat_id, jeton_chiffre, nom_bot,
        nom, bot_verifie, statut_connexion, dernier_test_le, updated_at)
     VALUES ($1,$2,'personnalise',$3,$4,$5,$6,true,'en-ligne',now(),now())
     ON CONFLICT (tenant_id) DO UPDATE
     SET utilisateur_id=$2, mode='personnalise', chat_id=$3,
         jeton_chiffre=$4, nom_bot=$5, nom=$6, bot_verifie=true,
         statut_connexion='en-ligne', dernier_test_le=now(),
         updated_at=now()
     RETURNING mode, nom, chat_id, jeton_chiffre, nom_bot, bot_verifie,
       statut_connexion, dernier_test_le`,
    [
      ctx.tenantId,
      ctx.utilisateurId,
      chatId.trim(),
      chiffrer(jeton.trim()),
      verifie.nom,
      nom.trim(),
    ],
  );
  return { bot: versBot((rows as Ligne[])[0]) };
}

// Teste le bot COTE SERVEUR (getMe) et memorise statut + date du test.
export async function testerBot(
  ctx: ContexteTenant,
): Promise<{ nom: string } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT mode, jeton_chiffre FROM configurations_telegram
     WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const lignes = rows as { mode: string; jeton_chiffre: string | null }[];
  if (lignes.length === 0) return { erreur: "Aucun bot configuré." };
  const jeton =
    lignes[0].mode === "central"
      ? (process.env.TELEGRAM_BOT_TOKEN ?? "").trim()
      : lignes[0].jeton_chiffre
        ? dechiffrer(lignes[0].jeton_chiffre as string)
        : "";
  if (!jeton) return { erreur: "Jeton manquant côté serveur." };
  try {
    const verifie = await verifierJetonBot(jeton);
    await db.query(
      `UPDATE configurations_telegram
       SET statut_connexion='en-ligne', dernier_test_le=now(),
           bot_verifie=true, nom_bot=$2, updated_at=now()
       WHERE tenant_id=$1`,
      [ctx.tenantId, verifie.nom],
    );
    return { nom: verifie.nom };
  } catch (e) {
    await db.query(
      `UPDATE configurations_telegram
       SET statut_connexion='hors-ligne', dernier_test_le=now(),
           updated_at=now()
       WHERE tenant_id=$1`,
      [ctx.tenantId],
    );
    return { erreur: e instanceof Error ? e.message : "Test impossible." };
  }
}

// Secret du webhook Telegram de l'espace (un par utilisateur). Genere
// cote serveur, stocke chiffre, verifie a chaque appel entrant.
export async function secretWebhookTelegram(
  ctx: ContexteTenant,
): Promise<string> {
  verifierContexte(ctx);
  await assurerEspace(ctx);
  const { rows } = await db.query(
    `SELECT secret_webhook FROM configurations_telegram WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const lignes = rows as { secret_webhook: string | null }[];
  if (lignes.length > 0 && lignes[0].secret_webhook) {
    return dechiffrer(lignes[0].secret_webhook);
  }
  const secret = randomBytes(32).toString("hex");
  await db.query(
    `INSERT INTO configurations_telegram (tenant_id, utilisateur_id, chat_id,
       mode, secret_webhook)
     VALUES ($1,$2,'','central',$3)
     ON CONFLICT (tenant_id) DO UPDATE
     SET secret_webhook=$3, updated_at=now()`,
    [ctx.tenantId, ctx.utilisateurId, chiffrer(secret)],
  );
  return secret;
}
