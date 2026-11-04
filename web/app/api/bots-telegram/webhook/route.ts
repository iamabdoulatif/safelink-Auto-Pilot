import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import { secretWebhookTelegram } from "@/lib/bots-telegram";
import { session } from "@/lib/session";

// Webhook Telegram PAR UTILISATEUR : chaque espace possede son secret,
// genere cote serveur et jamais expose. Telegram renvoie ce secret dans
// l'en-tete X-Telegram-Bot-Api-Secret-Token (parametre secret_token de
// setWebhook) : l'appel est refuse sans lui. Les mises a jour sont
// idempotentes sur update_id (source 'telegram').
//
// Configuration (PUT, authentifie) : { url_publique } -> setWebhook avec
// le secret de l'espace. Reception (POST, ?tenant=...) : mise a jour
// Telegram, verifiee puis accusee, sans journaliser de contenu sensible.

function comparer(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && ba.length > 0
    && timingSafeEqual(ba, bb);
}

export async function GET() {
  const ctx = await session();
  try {
    const { rows } = await db.query(
      `SELECT chat_id, mode, statut_connexion, dernier_test_le,
         (secret_webhook IS NOT NULL) AS secret_configure
       FROM configurations_telegram WHERE tenant_id=$1`,
      [ctx.tenantId],
    );
    const lignes = rows as {
      chat_id: string;
      mode: string;
      statut_connexion: string;
      dernier_test_le: string | null;
      secret_configure: boolean;
    }[];
    return Response.json({
      data: {
        configure: lignes.length > 0,
        secret_configure: lignes.length > 0 && lignes[0].secret_configure,
        aide: "Appelez PUT avec url_publique pour lier ce bot " +
          "(setWebhook + secret_token), puis Telegram appellera " +
          "POST ?tenant=" + ctx.tenantId + " a chaque message.",
      },
    });
  } catch (e) {
    console.error("[webhook-telegram]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

// Lie le webhook Telegram (setWebhook + secret_token de l'espace).
async function configurer(urlPublique: string): Promise<Response> {
  const ctx = await session();
  if (!/^https:\/\/[^/\s]+(\/.*)?$/.test(urlPublique.trim())) {
    return Response.json(
      { error: "URL publique invalide (https obligatoire)." },
      { status: 400 });
  }
  try {
    const { rows } = await db.query(
      `SELECT mode, jeton_chiffre FROM configurations_telegram
       WHERE tenant_id=$1`,
      [ctx.tenantId],
    );
    const lignes = rows as { mode: string; jeton_chiffre: string | null }[];
    if (lignes.length === 0) {
      return Response.json({ error: "Configurez d'abord un bot." },
        { status: 404 });
    }
    const jeton = lignes[0].mode === "central"
      ? (process.env.TELEGRAM_BOT_TOKEN ?? "").trim()
      : lignes[0].jeton_chiffre
        ? dechiffrer(lignes[0].jeton_chiffre as string)
        : "";
    if (!jeton) {
      return Response.json({ error: "Jeton manquant côté serveur." },
        { status: 409 });
    }
    const secret = await secretWebhookTelegram(ctx);
    const appel = await fetch(
      "https://api.telegram.org/bot" + jeton + "/setWebhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          url: urlPublique.trim() + "?tenant=" +
            encodeURIComponent(ctx.tenantId),
          secret_token: secret,
        }),
      },
    );
    const reponse = (await appel.json()) as { ok?: unknown };
    if (reponse.ok !== true) {
      return Response.json(
        { error: "Telegram a refusé le webhook." },
        { status: 502 });
    }
    return Response.json({ data: { webhook_lie: true } });
  } catch (e) {
    console.error("[webhook-telegram]", e);
    return Response.json({ error: "Liaison impossible." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const url = typeof b["url_publique"] === "string" ? b["url_publique"] : "";
  if (!url) {
    return Response.json({ error: "url_publique obligatoire." },
      { status: 400 });
  }
  return configurer(url);
}

// Reception d'une mise a jour Telegram : signature d'abord, doublon
// ensuite (update_id), traitement sobre sans aucun journal de contenu.
export async function POST(req: Request) {
  const tenant = new URL(req.url).searchParams.get("tenant") ?? "";
  if (!tenant) {
    return Response.json({ error: "Paramètre tenant manquant." },
      { status: 400 });
  }
  const brut = await req.text();
  const jetonTelegram = req.headers.get("x-telegram-bot-api-secret-token")
    ?? "";
  const hmac = req.headers.get("x-signature-telegram") ?? "";
  try {
    const { rows } = await db.query(
      `SELECT secret_webhook FROM configurations_telegram
       WHERE tenant_id=$1`,
      [tenant],
    );
    const lignes = rows as { secret_webhook: string | null }[];
    if (lignes.length === 0 || !lignes[0].secret_webhook) {
      return Response.json({ error: "Espace inconnu." }, { status: 404 });
    }
    const secret = dechiffrer(lignes[0].secret_webhook as string);
    const { createHmac } = await import("node:crypto");
    const attendu = createHmac("sha256", secret).update(brut, "utf8")
      .digest("hex");
    const authentifie = comparer(jetonTelegram, secret)
      || (hmac !== "" && comparer(hmac, attendu));
    if (!authentifie) {
      return Response.json({ error: "Signature invalide." }, { status: 401 });
    }
    let corps: { update_id?: unknown };
    try {
      corps = JSON.parse(brut) as { update_id?: unknown };
    } catch {
      return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
    }
    if (!Number.isInteger(corps.update_id)) {
      return Response.json({ error: "update_id manquant." }, { status: 400 });
    }
    const cle = "mise-a-jour-" + String(corps.update_id);
    const { rowCount } = await db.query(
      `INSERT INTO webhooks_recus (source, cle_unique)
       VALUES ('telegram', $1) ON CONFLICT (source, cle_unique) DO NOTHING`,
      [tenant + ":" + cle],
    );
    if ((rowCount ?? 0) === 0) {
      return Response.json({ data: { deja_traite: true } });
    }
    return Response.json({ data: { recue: true } });
  } catch (e) {
    console.error("[webhook-telegram]", e);
    return Response.json({ error: "Traitement impossible." },
      { status: 500 });
  }
}
