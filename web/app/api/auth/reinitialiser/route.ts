import { reinitialiserMotDePasse } from "@/lib/compte";

// Change le mot de passe avec un lien valide, puis renvoie vers la connexion.
export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  try {
    const resultat = await reinitialiserMotDePasse(b["jeton"], b["motDePasse"]);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    return Response.json({ data: { reinitialise: true } });
  } catch {
    console.error("[auth-reinitialiser] Réinitialisation impossible.");
    return Response.json({ error: "Réinitialisation impossible." }, { status: 500 });
  }
}
