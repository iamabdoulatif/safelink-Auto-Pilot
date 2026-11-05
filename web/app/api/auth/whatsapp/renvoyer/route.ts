import { normaliserCourriel } from "@/lib/auth";
import {
  delaiAvantRenvoi,
  envoyerCodeWhatsApp,
  etatVerification,
} from "@/lib/verification-whatsapp";

// Renvoi du code WhatsApp : compte existant non vérifié uniquement,
// un renvoi par minute maximum. La réponse ne révèle pas si le
// courriel existe (même message dans tous les cas d'absence).
export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const courriel = normaliserCourriel(b["courriel"]);
  if (!courriel) return Response.json({ error: "Courriel invalide." }, { status: 400 });
  try {
    const etat = await etatVerification(courriel);
    if (!etat || etat.verifie || !etat.numero) {
      return Response.json(
        { error: "Aucune validation en attente pour ce courriel." },
        { status: 400 },
      );
    }
    const delai = await delaiAvantRenvoi(courriel);
    if (delai > 0) {
      return Response.json(
        { error: `Patientez ${delai} s avant un nouveau code.` },
        { status: 429 },
      );
    }
    const { envoye } = await envoyerCodeWhatsApp(courriel, etat.numero);
    if (!envoye) {
      return Response.json(
        { error: "Envoi WhatsApp indisponible pour le moment. Réessayez dans une minute." },
        { status: 502 },
      );
    }
    return Response.json({ data: { envoye: true } });
  } catch (e) {
    console.error("[auth-whatsapp-renvoyer]", e);
    return Response.json({ error: "Renvoi impossible." }, { status: 500 });
  }
}
