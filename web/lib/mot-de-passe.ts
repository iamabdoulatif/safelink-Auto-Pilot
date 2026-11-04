import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Mots de passe : scrypt (memoire dure) + sel aleatoire, sans dependance.
// API synchrone : ~100 ms par appel, acceptable pour connexion/inscription.
// Format stocke : "scrypt$N$r$p$selHex$hashHex". La verification ne leve
// jamais : un hachage malforme rend false.
const N = 16384;
const R = 8;
const P = 1;
const TAILLE_CLE = 64;

export function hacherMotDePasse(clair: string): string {
  const sel = randomBytes(16);
  const derivee = scryptSync(clair, sel, TAILLE_CLE, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sel.toString("hex")}$${derivee.toString("hex")}`;
}

export function verifierMotDePasse(clair: string, hash: string): boolean {
  try {
    const morceaux = hash.split("$");
    if (morceaux.length !== 6 || morceaux[0] !== "scrypt") return false;
    const n = Number(morceaux[1]);
    const r = Number(morceaux[2]);
    const p = Number(morceaux[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    if (n <= 1 || r <= 0 || p <= 0) return false;
    const sel = Buffer.from(morceaux[4], "hex");
    const attendue = Buffer.from(morceaux[5], "hex");
    if (sel.length !== 16 || attendue.length !== TAILLE_CLE) return false;
    const derivee = scryptSync(clair, sel, TAILLE_CLE, { N: n, r, p });
    return derivee.length === attendue.length && timingSafeEqual(derivee, attendue);
  } catch {
    return false;
  }
}
