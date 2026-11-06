import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { testerBot } from "@/lib/bots-telegram";

// Teste le bot COTE SERVEUR via getMe et memorise le statut et la date.
// Un jeton invalide est refuse : rien n'est ecrit et aucun secret ne sort.
export async function POST() {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  try {
    const resultat = await testerBot(ctx);
    if ("erreur" in resultat) {
      const absent = resultat.erreur.includes("Aucun bot");
      return Response.json(
        { error: resultat.erreur },
        { status: absent ? 404 : 502 },
      );
    }
    return Response.json({ data: { en_ligne: true, nom: resultat.nom } });
  } catch (e) {
    console.error("[bot-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
