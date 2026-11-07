import {
  signerSession,
  verifierSession,
  type IdentiteSession,
} from "./session-cookie.ts";

// API mobile v1 : authentification par jeton Bearer, sans cookie.
// Le jeton a le même format signé (HMAC serveur) que la session web,
// avec une durée de 30 jours adaptée au mobile. Un changement de mot
// de passe le révoque (contrôle existant dans lib/session).
// Aucun secret ne transite : le jeton ne contient que l'identité.
export const DUREE_JETON_MOBILE_SECONDES = 30 * 24 * 3600;

export function emettreJetonMobile(
  secret: string,
  identite: IdentiteSession,
): string {
  return signerSession(secret, identite, {
    dureeSecondes: DUREE_JETON_MOBILE_SECONDES,
  });
}

// Extrait le jeton d'un en-tête Authorization: Bearer <jeton>.
export function lireJetonBearer(
  autorisation: string | null | undefined,
): string | null {
  if (!autorisation) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(autorisation.trim());
  return m ? m[1] : null;
}

export function verifierJetonMobile(
  secret: string,
  jeton: string | null | undefined,
): IdentiteSession | null {
  return verifierSession(secret, jeton);
}
