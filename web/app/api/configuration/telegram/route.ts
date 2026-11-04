import { session } from "@/lib/session";
import {
  lireBot,
  enregistrerBotCentral,
  enregistrerBotPersonnalise,
  testerBot,
} from "@/lib/bots-telegram";

// Configuration Telegram de l'espace : bot central (Chat ID uniquement,
// jeton serveur) ou personnalise (jeton getMe + getChat, chiffre).
// Le jeton n'est JAMAIS renvoye au navigateur ni journalise.
function presenter(
  bot: {
    mode: string; nom: string | null; chatId: string;
    statutConnexion: string; dernierTestLe: string | null;
    jetonConfigure: boolean; botVerifie: boolean;
  } | null,
) {
  if (!bot) return null;
  return {
    mode: bot.mode,
    chat_id: bot.chatId,
    jeton: bot.jetonConfigure ? "configuré" : "absent",
    nom_bot: bot.nom,
    bot_verifie: bot.botVerifie,
    statut_connexion: bot.statutConnexion,
    dernier_test_le: bot.dernierTestLe,
  };
}

const MODES = ["central", "personnalise"] as const;

export async function GET() {
  const { tenantId, utilisateurId } = await session();
  try {
    const bot = await lireBot({ tenantId, utilisateurId });
    return Response.json({ data: presenter(bot) });
  } catch (e) {
    console.error("[config-telegram]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const ctx = { tenantId, utilisateurId };
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const mode = typeof b["mode"] === "string" ? b["mode"] : "";
  const chatId = typeof b["chat_id"] === "string" ? b["chat_id"].trim() : "";
  const jeton = typeof b["jeton"] === "string" ? b["jeton"].trim() : "";
  const nom = typeof b["nom_bot"] === "string" ? b["nom_bot"].trim()
    : typeof b["nom"] === "string" ? b["nom"].trim() : "bot";

  if (!(MODES as readonly string[]).includes(mode)) {
    return Response.json(
      { error: "Mode inconnu : central ou personnalise." },
      { status: 400 });
  }
  try {
    // getMe puis getChat COTE SERVEUR avant toute ecriture.
    const resultat = mode === "central"
      ? await enregistrerBotCentral(ctx, chatId)
      : await enregistrerBotPersonnalise(ctx, nom, jeton, chatId);
    if ("erreur" in resultat) {
      const statut = /refus|inconnu|injoignable|manquant/i.test(
        resultat.erreur) ? 502 : 400;
      return Response.json({ error: resultat.erreur }, { status: statut });
    }
    return Response.json({ data: presenter(resultat.bot) },
      { status: 201 });
  } catch (e) {
    console.error("[config-telegram]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}

// Re-teste le bot COTE SERVEUR (getMe + statut + date).
export async function PUT() {
  const { tenantId, utilisateurId } = await session();
  try {
    const resultat = await testerBot({ tenantId, utilisateurId });
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 502 });
    }
    const bot = await lireBot({ tenantId, utilisateurId });
    return Response.json({
      data: { ...presenter(bot), nom_verifie: resultat.nom },
    });
  } catch (e) {
    console.error("[config-telegram]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
