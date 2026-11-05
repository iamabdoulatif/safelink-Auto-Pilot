import { db } from "@/lib/db";
import { chiffrer, dechiffrer } from "@/lib/chiffrement-serveur";

// Paramètres de la plateforme, réglés depuis l'espace superadmin et
// stockés en base (table parametres_plateforme). Les variables
// d'environnement du même nom servent de repli si rien n'est réglé.
// Le secret du webhook est chiffré en base et ne ressort jamais en
// clair vers le navigateur : seulement « configuré » ou « absent ».
export type ParametresPlateforme = {
  lienCommunaute: string;
  webhookOtpUrl: string;
  secretOtpConfigure: boolean;
};

const CLE_LIEN = "lien_communaute";
const CLE_WEBHOOK = "whatsapp_otp_webhook_url";
const CLE_SECRET = "whatsapp_otp_secret_chiffre";

async function lireCle(cle: string): Promise<string | null> {
  const { rows } = await db.query<{ valeur: string | null }>(
    `SELECT valeur FROM parametres_plateforme WHERE cle = $1`,
    [cle],
  );
  return rows[0]?.valeur ?? null;
}

async function ecrireCle(cle: string, valeur: string | null): Promise<void> {
  await db.query(
    `INSERT INTO parametres_plateforme (cle, valeur, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (cle) DO UPDATE SET valeur = $2, updated_at = now()`,
    [cle, valeur],
  );
}

export async function lireParametresPlateforme(): Promise<ParametresPlateforme> {
  const [lien, webhook, secret] = await Promise.all([
    lireCle(CLE_LIEN),
    lireCle(CLE_WEBHOOK),
    lireCle(CLE_SECRET),
  ]);
  return {
    lienCommunaute: lien ?? process.env.LIEN_COMMUNAUTE?.trim() ?? "",
    webhookOtpUrl: webhook ?? process.env.WHATSAPP_OTP_WEBHOOK_URL?.trim() ?? "",
    secretOtpConfigure: Boolean(secret) || Boolean(process.env.WHATSAPP_OTP_SECRET?.trim()),
  };
}

// Lien du groupe (WhatsApp ou Telegram) après validation du code.
export async function lienCommunaute(): Promise<string | null> {
  const { lienCommunaute: lien } = await lireParametresPlateforme();
  return lien || null;
}

// Webhook + secret d'envoi du code, côté serveur uniquement.
export async function configEnvoiOtp(): Promise<{ url: string; secret: string }> {
  const [webhook, secretChiffre] = await Promise.all([
    lireCle(CLE_WEBHOOK),
    lireCle(CLE_SECRET),
  ]);
  let secret = process.env.WHATSAPP_OTP_SECRET?.trim() || process.env.N8N_WEBHOOK_SECRET?.trim() || "";
  if (secretChiffre) {
    try {
      secret = dechiffrer(secretChiffre);
    } catch {
      // Secret illisible (clé changée) : on garde le repli environnement.
    }
  }
  return {
    url: webhook ?? process.env.WHATSAPP_OTP_WEBHOOK_URL?.trim() ?? "",
    secret,
  };
}

function urlValide(brut: string): boolean {
  if (!brut) return true; // vide = réglage effacé, accepté
  if (brut.length > 500) return false;
  try {
    const u = new URL(brut);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function enregistrerParametresPlateforme(entree: {
  lienCommunaute: unknown;
  webhookOtpUrl: unknown;
  secretOtp: unknown;
}): Promise<{ parametres: ParametresPlateforme } | { erreur: string }> {
  const lien = typeof entree.lienCommunaute === "string" ? entree.lienCommunaute.trim() : "";
  const webhook = typeof entree.webhookOtpUrl === "string" ? entree.webhookOtpUrl.trim() : "";
  const secret = typeof entree.secretOtp === "string" ? entree.secretOtp : "";
  if (!urlValide(lien)) return { erreur: "Lien du groupe invalide (URL http ou https)." };
  if (!urlValide(webhook)) return { erreur: "URL du webhook WhatsApp invalide (http ou https)." };
  if (secret.length > 256) return { erreur: "Secret trop long (256 caractères maximum)." };

  // Le secret est chiffré AVANT toute écriture : si le chiffrement
  // échoue, rien n'est enregistré à moitié.
  const secretChiffre = secret ? chiffrer(secret) : null;
  await ecrireCle(CLE_LIEN, lien || null);
  await ecrireCle(CLE_WEBHOOK, webhook || null);
  // Secret vide dans le formulaire = on garde celui déjà stocké.
  if (secretChiffre) await ecrireCle(CLE_SECRET, secretChiffre);
  return { parametres: await lireParametresPlateforme() };
}
