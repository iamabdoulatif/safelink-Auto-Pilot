import { inscrireCompte } from "@/lib/auth";
import { envoyerCodeWhatsApp } from "@/lib/verification-whatsapp";

// Inscription : cree l'espace (tenant = courriel) et le compte NON
// verifie, puis envoie le code de validation WhatsApp. Aucune session
// n'est ouverte ici : elle viendra de /api/auth/whatsapp/verifier.
// 409 si le courriel est pris.
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
    const resultat = await inscrireCompte(b["courriel"], b["motDePasse"], b);
    if ("erreur" in resultat) {
      const statut = resultat.erreur === "Courriel déjà utilisé." ? 409 : 400;
      return Response.json({ error: resultat.erreur }, { status: statut });
    }
    const { envoye } = await envoyerCodeWhatsApp(
      resultat.utilisateurId,
      resultat.numero ?? "",
    );
    return Response.json({
      data: {
        verificationRequise: true,
        courriel: resultat.utilisateurId,
        codeEnvoye: envoye,
      },
    });
  } catch (e) {
    console.error("[auth-inscription]", e);
    return Response.json({ error: "Inscription impossible." }, { status: 500 });
  }
}
