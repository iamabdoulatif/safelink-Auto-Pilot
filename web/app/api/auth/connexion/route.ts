import { attributCookieSession } from "@/lib/session-cookie";
import { cookiePourCompte, verifierConnexion } from "@/lib/auth";
import { envoyerCodeWhatsApp, etatVerification } from "@/lib/verification-whatsapp";

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
    // Numéro WhatsApp pas encore validé : pas de session, un nouveau
    // code part et le client bascule sur l'écran de validation.
    const etat = await etatVerification(resultat.utilisateurId);
    if (etat && !etat.verifie) {
      if (etat.numero) await envoyerCodeWhatsApp(resultat.utilisateurId, etat.numero);
      return Response.json(
        {
          error: "Validez d'abord le code reçu sur WhatsApp.",
          data: { verificationRequise: true, courriel: resultat.utilisateurId },
        },
        { status: 403 },
      );
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
