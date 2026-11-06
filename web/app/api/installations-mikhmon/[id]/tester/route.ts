import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { testerInstallation } from "@/lib/mikhmon-installations";

// Teste une installation COTE SERVEUR (jamais depuis le navigateur) et
// memorise le statut et la date du test. Aucun secret n'est journalise.
export async function POST(_req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n <= 0) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const resultat = await testerInstallation(ctx, n);
    if ("erreur" in resultat) {
      const absent = resultat.erreur.includes("introuvable");
      return Response.json(
        { error: resultat.erreur },
        { status: absent ? 404 : 502 },
      );
    }
    return Response.json({ data: { en_ligne: true } });
  } catch (e) {
    console.error("[installation-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
