import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { configEnvoiOtp } from "@/lib/parametres-plateforme";

// Code de validation WhatsApp : 6 chiffres, 10 minutes, 5 tentatives.
// Seul le haché SHA-256 (courriel + code) est stocké ; le code en clair
// ne vit que dans le message envoyé, jamais en base ni dans les logs.
// L'envoi part vers le webhook adaptateur configuré par
// WHATSAPP_OTP_WEBHOOK_URL, signé en HMAC (X-Signature) comme les
// autres déclenchements n8n de l'application.
const DUREE_CODE_MINUTES = 10;
const MAX_TENTATIVES = 5;
const DELAI_RENVOI_SECONDES = 60;

function hacherCode(courriel: string, code: string): string {
  return createHash("sha256").update(`${courriel}:${code}`, "utf8").digest("hex");
}

export async function envoyerCodeWhatsApp(
  courriel: string,
  numero: string,
): Promise<{ envoye: boolean }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Un seul code actif : les précédents non consommés sont invalidés.
  await db.query(
    `UPDATE verifications_whatsapp SET consomme_le = now()
     WHERE courriel = $1 AND consomme_le IS NULL`,
    [courriel],
  );
  await db.query(
    `INSERT INTO verifications_whatsapp (courriel, code_hash, expire_le)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [courriel, hacherCode(courriel, code), String(DUREE_CODE_MINUTES)],
  );

  // Webhook réglé dans l'espace superadmin, repli environnement.
  const { url, secret } = await configEnvoiOtp();
  if (!url) return { envoye: false };
  const corps = JSON.stringify({
    numero,
    message: `SafeLink Auto-Pilot : votre code de validation est ${code}. Il expire dans ${DUREE_CODE_MINUTES} minutes. Ne le partagez pas.`,
  });
  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret
          ? { "X-Signature": createHmac("sha256", secret).update(corps).digest("hex") }
          : {}),
      },
      body: corps,
      signal: AbortSignal.timeout(15000),
    });
    return { envoye: reponse.ok };
  } catch {
    return { envoye: false };
  }
}

// Secondes à attendre avant un renvoi, 0 si le renvoi est permis.
export async function delaiAvantRenvoi(courriel: string): Promise<number> {
  const { rows } = await db.query<{ secondes: string }>(
    `SELECT EXTRACT(EPOCH FROM (created_at + ($2 || ' seconds')::interval - now())) AS secondes
     FROM verifications_whatsapp WHERE courriel = $1
     ORDER BY created_at DESC LIMIT 1`,
    [courriel, String(DELAI_RENVOI_SECONDES)],
  );
  if (rows.length === 0) return 0;
  return Math.max(0, Math.ceil(Number(rows[0].secondes)));
}

type LigneCode = {
  id: string;
  code_hash: string;
  tentatives: number;
  expire: boolean;
};

// Vérifie le code saisi. En cas de succès, le code est consommé et le
// numéro est marqué vérifié : c'est ce qui ouvre l'accès au SaaS.
export async function verifierCodeWhatsApp(
  courriel: string,
  codeBrut: unknown,
): Promise<{ ok: true } | { erreur: string }> {
  const code = typeof codeBrut === "string" ? codeBrut.trim() : "";
  if (!/^\d{6}$/.test(code)) return { erreur: "Code à 6 chiffres attendu." };
  const { rows } = await db.query<LigneCode>(
    `SELECT id, code_hash, tentatives, (expire_le <= now()) AS expire
     FROM verifications_whatsapp
     WHERE courriel = $1 AND consomme_le IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [courriel],
  );
  if (rows.length === 0) return { erreur: "Aucun code en attente. Demandez un nouveau code." };
  const ligne = rows[0];
  if (ligne.expire) return { erreur: "Code expiré. Demandez un nouveau code." };
  if (ligne.tentatives >= MAX_TENTATIVES) {
    return { erreur: "Trop de tentatives. Demandez un nouveau code." };
  }
  const attendu = Buffer.from(ligne.code_hash, "hex");
  const recu = Buffer.from(hacherCode(courriel, code), "hex");
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) {
    await db.query(
      `UPDATE verifications_whatsapp SET tentatives = tentatives + 1 WHERE id = $1`,
      [ligne.id],
    );
    return { erreur: "Code incorrect." };
  }
  await db.query(
    `UPDATE verifications_whatsapp SET consomme_le = now() WHERE id = $1`,
    [ligne.id],
  );
  await db.query(
    `UPDATE utilisateurs SET numero_verifie = true WHERE courriel = $1`,
    [courriel],
  );
  return { ok: true };
}

// État du compte pour la connexion : numéro vérifié ou pas, et le
// numéro où renvoyer le code. null si le courriel est inconnu.
export async function etatVerification(
  courriel: string,
): Promise<{ verifie: boolean; numero: string | null } | null> {
  const { rows } = await db.query<{ numero_verifie: boolean; numero: string | null }>(
    `SELECT numero_verifie, numero FROM utilisateurs WHERE courriel = $1`,
    [courriel],
  );
  if (rows.length === 0) return null;
  return { verifie: rows[0].numero_verifie, numero: rows[0].numero };
}
