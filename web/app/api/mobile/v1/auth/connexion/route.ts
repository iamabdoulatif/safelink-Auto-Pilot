import { verifierConnexion } from "@/lib/auth";
import {
  DUREE_JETON_MOBILE_SECONDES,
  emettreJetonMobile,
} from "@/lib/api-mobile";

// Connexion mobile : courriel + mot de passe -> jeton Bearer 30 jours.
// Même refus générique que le web (on ne révèle pas si le compte existe).
export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const compte = await verifierConnexion(b["courriel"], b["motDePasse"]);
  if ("erreur" in compte) {
    return Response.json({ error: compte.erreur }, { status: 401 });
  }
  const secret = process.env.SESSION_SECRET ?? "";
  if (!secret) {
    return Response.json({ error: "Configuration serveur incomplète." },
      { status: 500 });
  }
  const jeton = emettreJetonMobile(secret, {
    utilisateurId: compte.utilisateurId,
    tenantId: compte.tenantId,
  });
  return Response.json({
    data: {
      jeton,
      type: "Bearer",
      expireDansSecondes: DUREE_JETON_MOBILE_SECONDES,
      utilisateur: {
        courriel: compte.utilisateurId,
        tenantId: compte.tenantId,
      },
    },
  });
}
