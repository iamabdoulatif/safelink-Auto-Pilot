import { changerMotDePasse } from "@/lib/compte";
import { reponseAuthentification, session } from "@/lib/session";
import { attributCookieSession } from "@/lib/session-cookie";

// Changement du mot de passe du compte connecte. Le nouveau cookie garde ce
// navigateur connecte ; les autres sessions sont revoquees.
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
    const ctx = await session();
    const resultat = await changerMotDePasse(
      secret,
      ctx,
      b["motDePasseActuel"],
      b["nouveauMotDePasse"],
    );
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    return Response.json(
      { data: { change: true } },
      {
        headers: {
          "Set-Cookie": attributCookieSession(
            resultat.cookie,
            process.env.NODE_ENV === "production",
          ),
        },
      },
    );
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[profil-mot-de-passe] Changement impossible.");
    return Response.json({ error: "Changement impossible." }, { status: 500 });
  }
}
