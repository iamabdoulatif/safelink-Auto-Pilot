import { cookies } from "next/headers";
import { NOM_COOKIE_SESSION, verifierSession } from "@/lib/session-cookie";

// État de session pour l'affichage public (en-tête de la landing) :
// dit seulement si le cookie signé est valide, comme le portier Edge.
// Aucune identité n'est renvoyée au navigateur.
export async function GET() {
  const secret = process.env.SESSION_SECRET ?? "";
  const valeur = (await cookies()).get(NOM_COOKIE_SESSION)?.value ?? null;
  const connecte = secret ? verifierSession(secret, valeur) !== null : false;
  return Response.json({ data: { connecte } });
}
