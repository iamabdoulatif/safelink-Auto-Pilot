import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement";

// Contexte Telegram d'un chat : retrouve l'espace (tenant) associe au
// Chat ID et renvoie le mode du bot (+ jeton dechiffre si personnalise).
// Appelé par le workflow n8n AVANT tout envoi (clavier, accusé) :
// lecture seule, aucune reservation. Secret partage via l'en-tete
// x-n8n-secret (jamais dans l'URL ni les logs).
function secretAttendu(): Buffer | null {
  const s = process.env.N8N_WEBHOOK_SECRET ?? "";
  return s ? Buffer.from(s) : null;
}

function secretValide(recu: string): boolean {
  const attendu = secretAttendu();
  if (!attendu || !recu) return false;
  const a = createHash("sha256").update(attendu).digest();
  const b = createHash("sha256").update(Buffer.from(recu)).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretAttendu()) {
    return Response.json({ error: "Secret n8n non configuré." },
      { status: 503 });
  }
  if (!secretValide(req.headers.get("x-n8n-secret") ?? "")) {
    return Response.json({ error: "Secret invalide." }, { status: 401 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const chatId = typeof b["chatId"] === "string" ? b["chatId"].trim()
    : typeof b["chat_id"] === "string" ? b["chat_id"].trim() : "";
  if (!chatId) {
    return Response.json({ error: "chatId obligatoire." }, { status: 400 });
  }

  try {
    const { rows } = await db.query(
      `SELECT tenant_id, utilisateur_id, mode, jeton_chiffre
       FROM configurations_telegram WHERE chat_id = $1`,
      [chatId]);
    const lignes = rows as {
      tenant_id: string; utilisateur_id: string; mode: string;
      jeton_chiffre: string | null;
    }[];
    if (lignes.length === 0) {
      return Response.json({
        data: { tenantId: null, userId: null, telegramMode: "central",
          telegramBotToken: "", connu: false },
      });
    }
    const l = lignes[0];
    let jeton = "";
    if (l.mode === "personnalise" && l.jeton_chiffre) {
      try {
        jeton = dechiffrer(l.jeton_chiffre);
      } catch {
        jeton = "";
      }
    }
    return Response.json({
      data: { tenantId: l.tenant_id, userId: l.utilisateur_id,
        telegramMode: l.mode, telegramBotToken: jeton, connu: true },
    });
  } catch (e) {
    console.error("[telegram-contexte]", e);
    return Response.json({ error: "Echec de la recherche." },
      { status: 500 });
  }
}
