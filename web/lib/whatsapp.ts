import { db } from "@/lib/db";
import { assurerEspace, verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { chiffrer, dechiffrer } from "@/lib/chiffrement-serveur";

// Configuration WhatsApp par espace : URL de l'adaptateur (webhook),
// destinataire par defaut, secret eventuel chiffre, activation.
// L'envoi (PDF + resume textuel) est realise par le workflow n8n ;
// ici : validation, test de joignabilite et lecture masquee.
// Jamais de mot de passe dans une URL, jamais de secret journalise.
export type ConfigWhatsApp = {
  webhookUrl: string;
  destinataireDefaut: string;
  secretConfigure: boolean; // « configuré » ou « absent », jamais la valeur
  actif: boolean;
  statutConnexion: string;
  dernierTestLe: string | null;
};

type Ligne = {
  webhook_url: string;
  secret_chiffre: string | null;
  destinataire_defaut: string;
  actif: boolean;
  statut_connexion: string;
  dernier_test_le: string | null;
};

function versConfig(l: Ligne): ConfigWhatsApp {
  return {
    webhookUrl: l.webhook_url,
    destinataireDefaut: l.destinataire_defaut,
    secretConfigure: !!l.secret_chiffre,
    actif: l.actif,
    statutConnexion: l.statut_connexion,
    dernierTestLe: l.dernier_test_le,
  };
}

// Valide la forme, sans toucher au reseau.
export function validerEntreeWhatsApp(
  webhookUrl: string,
  destinataire: string,
): string | null {
  if (
    !webhookUrl.trim() ||
    !/^https?:\/\/[^/\s]+(\/.*)?$/i.test(webhookUrl.trim()) ||
    webhookUrl.trim().length > 300
  ) {
    return "URL du webhook invalide (http ou https).";
  }
  if (!destinataire.trim() || destinataire.trim().length > 128) {
    return "Destinataire obligatoire (1 à 128 caractères).";
  }
  return null;
}

// Teste la joignabilite COTE SERVEUR (simple GET, aucun secret transmis).
export async function testerWebhookWhatsApp(
  webhookUrl: string,
): Promise<{ joignable: boolean } | { erreur: string }> {
  try {
    await fetch(webhookUrl.trim(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    return { joignable: true };
  } catch {
    return { erreur: "Webhook WhatsApp injoignable." };
  }
}

// Lit la configuration de l'espace (secret jamais expose).
export async function lireConfigWhatsApp(
  ctx: ContexteTenant,
): Promise<ConfigWhatsApp | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT webhook_url, secret_chiffre, destinataire_defaut, actif,
       statut_connexion, dernier_test_le
     FROM configurations_whatsapp WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const lignes = rows as Ligne[];
  return lignes.length === 0 ? null : versConfig(lignes[0]);
}

// Enregistre (ou remplace) la configuration, secret chiffre.
export async function enregistrerConfigWhatsApp(
  ctx: ContexteTenant,
  webhookUrl: string,
  secret: string,
  destinataire: string,
  actif: boolean,
): Promise<{ config: ConfigWhatsApp } | { erreur: string }> {
  verifierContexte(ctx);
  const invalide = validerEntreeWhatsApp(webhookUrl, destinataire);
  if (invalide) return { erreur: invalide };
  if (secret && secret.length > 256) {
    return { erreur: "Secret trop long (256 caractères maximum)." };
  }
  await assurerEspace(ctx);
  const { rows } = await db.query(
    `INSERT INTO configurations_whatsapp
       (tenant_id, utilisateur_id, webhook_url, secret_chiffre,
        destinataire_defaut, actif, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,now())
     ON CONFLICT (tenant_id) DO UPDATE
     SET utilisateur_id=$2, webhook_url=$3, secret_chiffre=$4,
         destinataire_defaut=$5, actif=$6, updated_at=now()
     RETURNING webhook_url, secret_chiffre, destinataire_defaut, actif,
       statut_connexion, dernier_test_le`,
    [
      ctx.tenantId,
      ctx.utilisateurId,
      webhookUrl.trim(),
      secret ? chiffrer(secret) : null,
      destinataire.trim(),
      actif,
    ],
  );
  return { config: versConfig((rows as Ligne[])[0]) };
}

// Marque le resultat du test serveur (statut + date, jamais le secret).
export async function marquerTestWhatsApp(
  ctx: ContexteTenant,
  reussi: boolean,
): Promise<void> {
  verifierContexte(ctx);
  await db.query(
    `UPDATE configurations_whatsapp
     SET statut_connexion=$2, dernier_test_le=now(), updated_at=now()
     WHERE tenant_id=$1`,
    [ctx.tenantId, reussi ? "en-ligne" : "hors-ligne"],
  );
}

// Lit le secret dechiffre (serveur uniquement, pour l'appel n8n signe).
export async function lireSecretWhatsApp(
  ctx: ContexteTenant,
): Promise<string | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    "SELECT secret_chiffre FROM configurations_whatsapp WHERE tenant_id=$1",
    [ctx.tenantId],
  );
  const lignes = rows as { secret_chiffre: string | null }[];
  if (lignes.length === 0 || !lignes[0].secret_chiffre) return null;
  try {
    return dechiffrer(lignes[0].secret_chiffre);
  } catch {
    return null;
  }
}
