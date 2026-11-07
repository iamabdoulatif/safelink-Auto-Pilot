import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Portier des routes /api : exige le cookie de session signe, sauf sur
// les entrees qui ont leur propre preuve (HMAC n8n, secrets partages,
// CRON, login/inscription). Les en-tetes x-tenant-id / x-user-id et
// l'ancien cookie sl_tenant ne sont jamais lus. Les routes re-verifient
// le cookie cote serveur (voir lib/session.ts) : defense en profondeur.
// Tourne en Edge : WebCrypto uniquement, pas de node:crypto ici.
const NOM_COOKIE = "sl_session";

// Entrees publiques, chacune avec sa propre authentification :
// - /api/auth/* : inscription / connexion / deconnexion ;
// - /api/internal/* : HMAC-SHA256 (x-signature, voir lib/n8n-interne) ;
// - /api/n8n/retour : HMAC-SHA256 des comptes rendus ;
// - /api/telegram/* : secret partage x-n8n-secret ;
// - /api/tickets/auto : secret CRON (x-cron-secret) ;
// - /api/bots-telegram/webhook : secret propre a l'espace ;
// - /api/printnode/webhook : secret propre a l'espace (en-tete
//   x-printnode-webhook-secret).
const PUBLIC: readonly string[] = [
  "/api/auth/",
  "/api/internal/",
  "/api/n8n/retour",
  "/api/telegram/",
  "/api/tickets/auto",
  "/api/bots-telegram/webhook",
  "/api/printnode/webhook",
  "/api/mobile/v1/auth/",
  "/api/mobile/v1/sante",
];

function dechiffreB64Url(v: string): Uint8Array | null {
  try {
    const normalise = v.replace(/-/g, "+").replace(/_/g, "/");
    const binaire = atob(normalise);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return octets;
  } catch {
    return null;
  }
}

function comparer(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

async function cookieValide(secret: string, valeur: string): Promise<boolean> {
  const morceaux = valeur.split(".");
  if (morceaux.length !== 2) return false;
  const signature = dechiffreB64Url(morceaux[1]);
  if (!signature) return false;
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const attendue = new Uint8Array(
    await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(morceaux[0])),
  );
  if (!comparer(signature, attendue)) return false;
  let charge: { v?: unknown; uid?: unknown; tenant?: unknown; exp?: unknown };
  try {
    const json = new TextDecoder().decode(dechiffreB64Url(morceaux[0]) ?? new Uint8Array());
    charge = JSON.parse(json) as typeof charge;
  } catch {
    return false;
  }
  if (typeof charge !== "object" || charge === null || charge.v !== 1) return false;
  if (typeof charge.uid !== "string" || !charge.uid) return false;
  if (typeof charge.tenant !== "string" || !charge.tenant) return false;
  if (!Number.isInteger(charge.exp)) return false;
  return (charge.exp as number) * 1000 > Date.now();
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const chemin = req.nextUrl.pathname;
  // Visiteur sans session : la racine montre la page de presentation.
  if (chemin === "/") {
    const secretRacine = process.env.SESSION_SECRET ?? "";
    const cookieRacine = req.cookies.get(NOM_COOKIE)?.value ?? null;
    return secretRacine && cookieRacine && (await cookieValide(secretRacine, cookieRacine))
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/accueil", req.url));
  }
  if (PUBLIC.some((p) => chemin === p || chemin.startsWith(p))) {
    return NextResponse.next();
  }
  const secret = process.env.SESSION_SECRET ?? "";
  const cookie = req.cookies.get(NOM_COOKIE)?.value ?? null;
  if (secret && cookie && (await cookieValide(secret, cookie))) {
    return NextResponse.next();
  }
  // Client mobile : jeton Bearer signé (même format que le cookie).
  const autorisation = req.headers.get("authorization") ?? "";
  const jeton = /^Bearer\s+(\S+)$/i.exec(autorisation.trim())?.[1] ?? null;
  if (secret && jeton && (await cookieValide(secret, jeton))) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}

export const config = { matcher: ["/", "/api/:path*"] };
