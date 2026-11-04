import { attributCookieSession } from "@/lib/session-cookie";
import { cookiePourCompte, inscrireCompte } from "@/lib/auth";

// Inscription : cree l'espace (tenant = courriel) et le compte, puis
// connecte (cookie de session signe). 409 si le courriel est pris.
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
    const resultat = await inscrireCompte(b["courriel"], b["motDePasse"]);
    if ("erreur" in resultat) {
      const statut = resultat.erreur === "Courriel déjà utilisé." ? 409 : 400;
      return Response.json({ error: resultat.erreur }, { status: statut });
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
    console.error("[auth-inscription]", e);
    return Response.json({ error: "Inscription impossible." }, { status: 500 });
  }
}
