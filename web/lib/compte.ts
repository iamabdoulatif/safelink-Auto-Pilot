import { db } from "@/lib/db";
import { cookiePourCompte, normaliserCourriel, validerMotDePasse } from "@/lib/auth";
import type { CompteCree } from "@/lib/auth";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import { empreinteJeton, estChatPrive, genererJeton } from "@/lib/jeton-reinitialisation";
import { hacherMotDePasse, verifierMotDePasse } from "@/lib/mot-de-passe";
import { envoyerMessageTelegram } from "@/lib/telegram";

// Profil, changement et reinitialisation du mot de passe. Le lien de
// reinitialisation part sur le Telegram prive de l'espace ; le jeton n'est
// jamais stocke ni journalise, seule son empreinte est en base.
export type Profil = {
  courriel: string;
  creeLe: string;
  motDePasseChangeLe: string | null;
  recuperationTelegram: "disponible" | "groupe" | "absente";
};

export async function lireProfil(courriel: string): Promise<Profil | null> {
  const { rows } = await db.query<{
    courriel: string;
    created_at: Date;
    mot_de_passe_change_le: Date | null;
    chat_id: string | null;
  }>(
    `SELECT u.courriel, u.created_at, u.mot_de_passe_change_le, t.chat_id
     FROM utilisateurs u
     LEFT JOIN configurations_telegram t ON t.tenant_id = u.tenant_id
     WHERE u.courriel = $1`,
    [courriel],
  );
  const l = rows[0];
  if (!l) return null;
  return {
    courriel: l.courriel,
    creeLe: l.created_at.toISOString(),
    motDePasseChangeLe: l.mot_de_passe_change_le?.toISOString() ?? null,
    recuperationTelegram: !l.chat_id
      ? "absente"
      : estChatPrive(l.chat_id)
        ? "disponible"
        : "groupe",
  };
}

// Change le mot de passe d'un compte connecte. Rend le cookie de la nouvelle
// session : les sessions ouvertes avant ce changement sont revoquees.
export async function changerMotDePasse(
  secret: string,
  compte: CompteCree,
  actuel: unknown,
  nouveau: unknown,
): Promise<{ cookie: string } | { erreur: string }> {
  const invalide = validerMotDePasse(nouveau);
  if (invalide) return { erreur: invalide };
  const { rows } = await db.query<{ hash_mot_de_passe: string }>(
    "SELECT hash_mot_de_passe FROM utilisateurs WHERE courriel = $1",
    [compte.utilisateurId],
  );
  if (
    !rows[0] ||
    typeof actuel !== "string" ||
    !verifierMotDePasse(actuel, rows[0].hash_mot_de_passe)
  ) {
    return { erreur: "Mot de passe actuel incorrect." };
  }
  await db.query(
    `WITH liens AS (
       UPDATE reinitialisations_mot_de_passe SET utilise_le = now()
       WHERE courriel = $1 AND utilise_le IS NULL
     )
     UPDATE utilisateurs
     SET hash_mot_de_passe = $2, mot_de_passe_change_le = now()
     WHERE courriel = $1`,
    [compte.utilisateurId, hacherMotDePasse(nouveau as string)],
  );
  return { cookie: cookiePourCompte(secret, compte) };
}

// Envoie un lien si le compte existe et a un Telegram prive. Une demande au
// plus toutes les 2 minutes par compte, lien valable 30 minutes.
export async function demanderReinitialisation(courrielBrut: unknown): Promise<void> {
  const courriel = normaliserCourriel(courrielBrut);
  const baseUrl = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!courriel || !baseUrl) return;
  const { rows } = await db.query<{ chat_id: string; jeton_chiffre: string | null }>(
    `SELECT t.chat_id, t.jeton_chiffre
     FROM utilisateurs u
     JOIN configurations_telegram t ON t.tenant_id = u.tenant_id
     WHERE u.courriel = $1`,
    [courriel],
  );
  const telegram = rows[0];
  if (!telegram || !estChatPrive(telegram.chat_id)) return;
  const jetonBot = telegram.jeton_chiffre
    ? dechiffrer(telegram.jeton_chiffre)
    : (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!jetonBot) return;

  await db.query(
    `DELETE FROM reinitialisations_mot_de_passe
     WHERE expire_le < now() - interval '1 day'`,
  );
  const { jeton, empreinte } = genererJeton();
  const { rowCount } = await db.query(
    `INSERT INTO reinitialisations_mot_de_passe (courriel, empreinte, expire_le)
     SELECT $1, $2, now() + interval '30 minutes'
     WHERE NOT EXISTS (
       SELECT 1 FROM reinitialisations_mot_de_passe
       WHERE courriel = $1 AND created_at > now() - interval '2 minutes'
     )`,
    [courriel, empreinte],
  );
  if (!rowCount) return;
  await envoyerMessageTelegram(
    jetonBot,
    telegram.chat_id,
    "Réinitialisation du mot de passe SafeLink.\n\n" +
      "Lien valable 30 minutes :\n" +
      `${baseUrl}/reinitialiser?jeton=${jeton}\n\n` +
      "Si vous n'avez rien demandé, ignorez ce message.",
  );
}

// Consomme le lien et change le mot de passe en une seule requete : un lien
// ne sert qu'une fois, et les autres liens du compte sont annules.
export async function reinitialiserMotDePasse(
  jeton: unknown,
  nouveau: unknown,
): Promise<{ ok: true } | { erreur: string }> {
  const invalide = validerMotDePasse(nouveau);
  if (invalide) return { erreur: invalide };
  if (typeof jeton !== "string" || !jeton) {
    return { erreur: "Lien invalide ou expiré." };
  }
  const empreinte = empreinteJeton(jeton);
  const { rowCount } = await db.query(
    `WITH lien AS (
       UPDATE reinitialisations_mot_de_passe SET utilise_le = now()
       WHERE empreinte = $1 AND utilise_le IS NULL AND expire_le > now()
       RETURNING courriel
     ),
     autres AS (
       UPDATE reinitialisations_mot_de_passe r SET utilise_le = now()
       FROM lien
       WHERE r.courriel = lien.courriel AND r.utilise_le IS NULL
         AND r.empreinte <> $1
     )
     UPDATE utilisateurs u
     SET hash_mot_de_passe = $2, mot_de_passe_change_le = now()
     FROM lien
     WHERE u.courriel = lien.courriel`,
    [empreinte, hacherMotDePasse(nouveau as string)],
  );
  return rowCount ? { ok: true } : { erreur: "Lien invalide ou expiré." };
}
