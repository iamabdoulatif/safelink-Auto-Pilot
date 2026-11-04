import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Webhook Telegram de l'espace : Telegram appelle cette URL a chaque
// message recu (setWebhook cote bot). Authentification par secret propre
// a l'espace (?secret= ou en-tete X-Telegram-Secret), compare en temps
// constant. Anti-doublon sur update_id. Repond toujours 200 apres
// authentification (pas de tempete de reessais), 401 sinon.
function empreinte(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function secretsEgaux(attendu: string, recu: string): boolean {
  if (!attendu || !recu) return false;
  const a = empreinte(attendu);
  const b = empreinte(recu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const recu = url.searchParams.get("secret")
    ?? req.headers.get("x-telegram-secret") ?? "";
  const brut = await req.text();
  let corps: { update_id?: unknown };
  try {
    corps = JSON.parse(brut) as { update_id?: unknown };
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const updateId = Number.isInteger(corps.update_id)
    ? String(corps.update_id)
    : null;

  try {
    // Retrouve l'espace par comparaison du secret (un par utilisateur).
    const { rows } = await db.query(
      `SELECT tenant_id, secret_webhook FROM configurations_telegram
       WHERE secret_webhook IS NOT NULL`);
    const lignes = rows as {
      tenant_id: string; secret_webhook: string;
    }[];
    let tenantId: string | null = null;
    const { dechiffrer } = await import("@/lib/chiffrement");
    for (const l of lignes) {
      let clair = "";
      try {
        clair = dechiffrer(l.secret_webhook);
      } catch {
        continue;
      }
      if (secretsEgaux(clair, recu)) {
        tenantId = l.tenant_id;
        break;
      }
    }
    if (!tenantId) {
      return Response.json({ error: "Secret invalide." }, { status: 401 });
    }
    if (updateId) {
      const { rowCount } = await db.query(
        `INSERT INTO webhooks_recus (source, cle_unique)
         VALUES ('telegram', $1)
         ON CONFLICT (source, cle_unique) DO NOTHING`,
        ["tg-" + tenantId + "-" + updateId]);
      if ((rowCount ?? 0) === 0) {
        return Response.json({ data: { deja_traite: true } });
      }
    }
    // Accuse de reception : le dialogue metier (approbations, envois)
    // est porte par le workflow n8n, pas par ce webhook.
    return Response.json({ data: { recu: true } });
  } catch (e) {
    console.error("[telegram-webhook]", e);
    return Response.json({ error: "Echec du traitement." }, { status: 500 });
  }
}
