import { attributSuppressionCookie } from "@/lib/session-cookie";

// Deconnexion : supprime le cookie de session cote navigateur.
export async function POST() {
  return Response.json(
    { data: { deconnecte: true } },
    { headers: { "Set-Cookie": attributSuppressionCookie() } },
  );
}
