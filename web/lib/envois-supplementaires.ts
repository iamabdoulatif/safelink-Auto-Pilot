import { db } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import type { DestinataireSupplementaire } from "@/lib/destinataires-supplementaires";
import { verifierChatId } from "@/lib/telegram";

// Canaux de l'espace pour les autres destinataires. Controle a l'enregistrement,
// puis adresses d'envoi donnees a n8n au moment du run signe.
async function jetonTelegram(tenantId: string): Promise<string | null> {
  const { rows } = await db.query<{ jeton_chiffre: string | null }>(
    "SELECT jeton_chiffre FROM configurations_telegram WHERE tenant_id = $1",
    [tenantId],
  );
  if (rows.length === 0) return null;
  return rows[0].jeton_chiffre
    ? dechiffrer(rows[0].jeton_chiffre)
    : (process.env.TELEGRAM_BOT_TOKEN ?? "").trim() || null;
}

async function webhookWhatsApp(tenantId: string): Promise<string | null> {
  const { rows } = await db.query<{ webhook_url: string; statut_connexion: string }>(
    "SELECT webhook_url, statut_connexion FROM configurations_whatsapp WHERE tenant_id = $1",
    [tenantId],
  );
  return rows[0]?.statut_connexion === "en-ligne" ? rows[0].webhook_url : null;
}

export async function verifierDestinataires(
  tenantId: string,
  liste: DestinataireSupplementaire[],
): Promise<string | null> {
  if (liste.some((d) => d.canal === "whatsapp") && !(await webhookWhatsApp(tenantId))) {
    return "Configurez et testez WhatsApp avant d'ajouter un numéro.";
  }
  const chats = liste.filter((d) => d.canal === "telegram");
  if (chats.length === 0) return null;
  const jeton = await jetonTelegram(tenantId);
  if (!jeton) return "Configurez Telegram avant d'ajouter un chat ID.";
  for (const chat of chats) {
    try {
      await verifierChatId(jeton, chat.valeur);
    } catch {
      return `Chat ID ${chat.valeur} inconnu du bot : la personne doit d'abord ouvrir une discussion avec lui.`;
    }
  }
  return null;
}

export type EnvoiSupplementaire = {
  canal: DestinataireSupplementaire["canal"];
  destinataire: string;
  url: string | null; // null : canal retire depuis, l'echec sera signale
};

export async function resoudreEnvois(
  tenantId: string,
  liste: DestinataireSupplementaire[],
): Promise<EnvoiSupplementaire[]> {
  if (liste.length === 0) return [];
  const jeton = liste.some((d) => d.canal === "telegram")
    ? await jetonTelegram(tenantId)
    : null;
  const webhook = liste.some((d) => d.canal === "whatsapp")
    ? await webhookWhatsApp(tenantId)
    : null;
  return liste.map((d) => ({
    canal: d.canal,
    destinataire: d.valeur,
    url: d.canal === "telegram"
      ? jeton && `https://api.telegram.org/bot${jeton}/sendDocument`
      : webhook,
  }));
}
