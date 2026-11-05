import { demanderReinitialisation } from "@/lib/compte";

// Demande de lien : meme reponse dans tous les cas (anti-enumeration).
// L'envoi n'est pas attendu, pour que le delai ne revele rien non plus.
export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  void demanderReinitialisation(b["courriel"]).catch(() => {
    console.error("[mot-de-passe-oublie] Envoi du lien impossible.");
  });
  return Response.json({ data: { demande: true } });
}
