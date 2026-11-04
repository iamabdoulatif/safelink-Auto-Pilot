import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Chiffrement symetrique AES-256-GCM pour les secrets en base (jetons
// Telegram, mots de passe Mikhmon et RouterOS). Format stocke :
// "v1:<iv base64>:<contenu base64>" (l'etiquette d'authentification est
// soudee au contenu). La cle vient de CHIFFREMENT_CLE (32 octets en
// hexadecimal) : sans elle, le demarrage refuse de chiffrer.
function cle(): Buffer {
  const brut = (process.env.CHIFFREMENT_CLE ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(brut)) {
    throw new Error(
      "CHIFFREMENT_CLE manquante : 32 octets en hexadecimal (64 caracteres).",
    );
  }
  return Buffer.from(brut, "hex");
}

// Chiffre un secret. Ne jamais journaliser ni renvoyer "clair".
export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const contenu = Buffer.concat([c.update(clair, "utf8"), c.final()]);
  const etiquette = c.getAuthTag();
  const paquet = Buffer.concat([etiquette, contenu]).toString("base64");
  return "v1:" + iv.toString("base64") + ":" + paquet;
}

// Dechiffre une valeur produite par chiffrer(). Erreur si alteree.
export function dechiffrer(opaque: string): string {
  const morceaux = opaque.split(":");
  if (morceaux.length !== 3 || morceaux[0] !== "v1") {
    throw new Error("Secret illisible (format inconnu).");
  }
  const iv = Buffer.from(morceaux[1], "base64");
  const paquet = Buffer.from(morceaux[2], "base64");
  if (iv.length !== 12 || paquet.length < 17) {
    throw new Error("Secret illisible (donnees corrompues).");
  }
  const d = createDecipheriv("aes-256-gcm", cle(), iv);
  d.setAuthTag(paquet.subarray(0, 16));
  const clair = Buffer.concat([
    d.update(paquet.subarray(16)),
    d.final(),
  ]);
  return clair.toString("utf8");
}

// Pour l'interface : "configuré" ou "absent", jamais la valeur.
export function secretMasque(present: boolean): string {
  return present ? "configuré" : "absent";
}
