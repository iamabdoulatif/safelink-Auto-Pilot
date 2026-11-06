import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  enregistrerBotCentral,
  enregistrerBotPersonnalise,
  lireBot,
} from "@/lib/bots-telegram";

// Bots Telegram de l'espace : un bot central (chat ID seul, jeton cote
// serveur) ou un bot personnalise (jeton verifie via getMe AVANT ecriture,
// refuse s'il est invalide, puis chiffre et jamais reaffiche).
export async function GET() {
  const ctx = await session();
  try {
    const bot = await lireBot(ctx);
    return Response.json({ data: { bot } });
  } catch (e) {
    console.error("[bots-telegram]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;

  // Desactivation : le jeton est neutralise, le chat ID est conserve.
  if (b["action"] === "desactiver") {
    try {
      const { rowCount } = await db.query(
        `UPDATE configurations_telegram
         SET jeton_chiffre=NULL, bot_verifie=false,
             statut_connexion='jamais-teste', updated_at=now()
         WHERE tenant_id=$1`,
        [ctx.tenantId],
      );
      if ((rowCount ?? 0) === 0) {
        return Response.json({ error: "Aucun bot configuré." },
          { status: 404 });
      }
      const bot = await lireBot(ctx);
      return Response.json({ data: { bot, desactive: true } });
    } catch (e) {
      console.error("[bots-telegram]", e);
      return Response.json({ error: "Désactivation impossible." },
        { status: 500 });
    }
  }

  const mode = b["mode"];
  const chatId = typeof b["chatId"] === "string" ? b["chatId"] : "";
  try {
    if (mode === "central") {
      const resultat = await enregistrerBotCentral(ctx, chatId);
      if ("erreur" in resultat) {
        return Response.json({ error: resultat.erreur }, { status: 400 });
      }
      return Response.json({ data: { bot: resultat.bot } }, { status: 201 });
    }
    if (mode === "personnalise") {
      const nom = typeof b["nom"] === "string" ? b["nom"] : "";
      const jeton = typeof b["jeton"] === "string" ? b["jeton"] : "";
      if (!jeton) {
        return Response.json({ error: "Jeton du bot obligatoire." },
          { status: 400 });
      }
      const resultat = await enregistrerBotPersonnalise(ctx, nom, jeton,
        chatId);
      if ("erreur" in resultat) {
        return Response.json({ error: resultat.erreur }, { status: 400 });
      }
      return Response.json({ data: { bot: resultat.bot } }, { status: 201 });
    }
    return Response.json(
      { error: "Mode inconnu : central ou personnalise." },
      { status: 400 });
  } catch (e) {
    console.error("[bots-telegram]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}

// Supprime la configuration locale du bot, apres confirmation UI.
// Ne touche pas au bot cote Telegram : seul le jeton local disparait.
export async function DELETE() {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  try {
    const { rowCount } = await db.query(
      `DELETE FROM configurations_telegram WHERE tenant_id=$1`,
      [ctx.tenantId],
    );
    if ((rowCount ?? 0) === 0) {
      return Response.json({ error: "Aucun bot configuré." }, { status: 404 });
    }
    return Response.json({ data: { supprime: true } });
  } catch (e) {
    console.error("[bots-telegram]", e);
    return Response.json({ error: "Suppression impossible." },
      { status: 500 });
  }
}
