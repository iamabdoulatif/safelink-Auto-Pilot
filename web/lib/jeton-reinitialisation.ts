import { createHash, randomBytes } from "node:crypto";

// Fonctions pures de la reinitialisation (testables avec node --test) :
// jeton aleatoire, empreinte stockee en base, controle du chat Telegram.
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

export function genererJeton(): { jeton: string; empreinte: string } {
  const jeton = randomBytes(32).toString("base64url");
  return { jeton, empreinte: empreinteJeton(jeton) };
}

// Un chat prive a un identifiant positif. Un groupe (negatif) est refuse :
// tous ses membres pourraient utiliser le lien.
export function estChatPrive(chatId: string): boolean {
  return /^[1-9]\d{0,19}$/.test(chatId.trim());
}
