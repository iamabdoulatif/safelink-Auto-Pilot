import { createHmac, timingSafeEqual } from "node:crypto";

// Session signee, sans dependance a Next.js (testable avec node --test).
// Le cookie ne contient que l'identite (utilisateur + tenant) et une
// echeance : toute donnee metier reste en base, filtree par tenant_id.
// Les en-tetes x-tenant-id / x-user-id et l'ancien cookie sl_tenant ne
// sont JAMAIS lus : un client peut les falsifier librement.
export const NOM_COOKIE_SESSION = "sl_session";
export const DUREE_SESSION_SECONDES = 12 * 3600;

export type IdentiteSession = {
  utilisateurId: string;
  tenantId: string;
};

export type Session = IdentiteSession;

type Charge = { v: number; uid: unknown; tenant: unknown; exp: unknown };

function signerCharge(secret: string, chargeB64: string): Buffer {
  return createHmac("sha256", secret).update(chargeB64, "utf8").digest();
}

// Cree la valeur du cookie pour une identite. dureeSecondes et
// maintenantSec existent pour les tests (expiration controlee).
export function signerSession(
  secret: string,
  identite: IdentiteSession,
  options: { dureeSecondes?: number; maintenantSec?: number } = {},
): string {
  const maintenant = options.maintenantSec ?? Math.floor(Date.now() / 1000);
  const charge: Charge = {
    v: 1,
    uid: identite.utilisateurId,
    tenant: identite.tenantId,
    exp: maintenant + (options.dureeSecondes ?? DUREE_SESSION_SECONDES),
  };
  const chargeB64 = Buffer.from(JSON.stringify(charge), "utf8").toString("base64url");
  const signatureB64 = signerCharge(secret, chargeB64).toString("base64url");
  return chargeB64 + "." + signatureB64;
}

// Verifie un cookie : signature, forme, echeance. Rend null si invalide.
export function verifierSession(
  secret: string,
  valeur: string | null | undefined,
): Session | null {
  if (!secret || !valeur) return null;
  const morceaux = valeur.split(".");
  if (morceaux.length !== 2) return null;
  const [chargeB64, signatureB64] = morceaux;
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureB64, "base64url");
  } catch {
    return null;
  }
  const attendue = signerCharge(secret, chargeB64);
  if (signature.length !== attendue.length || !timingSafeEqual(signature, attendue)) {
    return null;
  }
  let charge: Charge;
  try {
    charge = JSON.parse(Buffer.from(chargeB64, "base64url").toString("utf8")) as Charge;
  } catch {
    return null;
  }
  if (typeof charge !== "object" || charge === null || charge.v !== 1) return null;
  if (typeof charge.uid !== "string" || !charge.uid) return null;
  if (typeof charge.tenant !== "string" || !charge.tenant) return null;
  if (!Number.isInteger(charge.exp)) return null;
  if ((charge.exp as number) * 1000 <= Date.now()) return null;
  return { utilisateurId: charge.uid, tenantId: charge.tenant };
}

// Point d'entree unique : l'identite vient du cookie signe, jamais des
// en-tetes. Sans cookie valide : null (la route repond 401).
export function resoudreContexte(
  valeurCookie: string | null | undefined,
  secret: string,
): Session | null {
  return verifierSession(secret, valeurCookie);
}

// Valeur d'en-tete Set-Cookie : HttpOnly toujours, Secure en production,
// SameSite=Lax (le strict casserait les retours depuis Telegram/n8n).
export function attributCookieSession(valeur: string, production: boolean): string {
  let attribut = `${NOM_COOKIE_SESSION}=${valeur}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DUREE_SESSION_SECONDES}`;
  if (production) attribut += "; Secure";
  return attribut;
}

export function attributSuppressionCookie(): string {
  return `${NOM_COOKIE_SESSION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
