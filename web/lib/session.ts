import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  NOM_COOKIE_SESSION,
  resoudreContexte,
  type Session,
} from "@/lib/session-cookie";

// Identite de l'appelant, lue cote serveur uniquement, depuis le cookie
// de session SIGNE (HMAC serveur). Les en-tetes x-tenant-id / x-user-id
// et l'ancien cookie sl_tenant sont ignores : un client peut les
// falsifier, ils ne decident plus de rien. Sans cookie valide : leve
// ErreurAuthentification (le middleware repond 401 avant la route).
export type { Session };

export class ErreurAuthentification extends Error {
  statut = 401 as const;
  constructor(message = "Authentification requise.") {
    super(message);
    this.name = "ErreurAuthentification";
  }
}

function secretSession(): string {
  return process.env.SESSION_SECRET ?? "";
}

export async function session(): Promise<Session> {
  const secret = secretSession();
  const valeur = (await cookies()).get(NOM_COOKIE_SESSION)?.value ?? null;
  const ctx = secret ? resoudreContexte(valeur, secret) : null;
  if (!ctx) throw new ErreurAuthentification();
  return ctx;
}

// A placer en tete des catch de routes : mappe l'echec d'auth en 401.
export function reponseAuthentification(e: unknown): Response | null {
  if (e instanceof ErreurAuthentification) {
    return Response.json({ error: e.message }, { status: e.statut });
  }
  return null;
}

// Pour les pages serveur : redirige vers /connexion sans session.
export async function sessionPage(): Promise<Session> {
  try {
    return await session();
  } catch (e) {
    if (e instanceof ErreurAuthentification) redirect("/connexion");
    throw e;
  }
}
