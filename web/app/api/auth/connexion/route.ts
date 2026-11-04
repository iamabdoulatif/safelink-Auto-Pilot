import { attributCookieSession } from "@/lib/session-cookie";
import { cookiePourCompte, verifierConnexion } from "@/lib/auth";

// Connexion : verifie le mot de passe puis pose le cookie de session
// signe. Message unique en echec (anti-enumeration des courriels).
export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET ?? "";
  if (!secret) {
    return Response.json({ error: "Sessions non configurées." }, { status: 503 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  try {
    const resultat = await verifierConnexion(b["courriel"], b["motDePasse"]);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 401 });
    }
    const cookie = cookiePourCompte(secret, resultat);
    return Response.json(
      { data: { tenantId: resultat.tenantId, utilisateurId: resultat.utilisateurId } },
      {
        headers: {
          "Set-Cookie": attributCookieSession(
            cookie,
            process.env.NODE_ENV === "production",
          ),
        },
      },
    );
  } catch (e) {
    console.error("[auth-connexion]", e);
    return Response.json({ error: "Connexion impossible." }, { status: 500 });
  }
}
