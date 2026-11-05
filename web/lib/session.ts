import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  emissionSession,
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
  // Une session ouverte avant le dernier changement de mot de passe est
  // revoquee. ponytail: le portier Edge ne lit pas la base, certaines routes
  // repondent donc 500 au lieu de 401 ; l'acces reste refuse.
  const { rows } = await db.query(
    `SELECT 1 FROM utilisateurs
     WHERE courriel = $1
       AND date_trunc('second', mot_de_passe_change_le) > to_timestamp($2)`,
    [ctx.utilisateurId, emissionSession(valeur as string)],
  );
  if (rows.length > 0) throw new ErreurAuthentification();
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
