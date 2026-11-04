import { session } from "@/lib/session";
import { testerInstallation } from "@/lib/mikhmon-installations";

// Teste la connexion COTE SERVEUR (jamais depuis le navigateur) puis
// memorise le statut et la date du test. Ne journalise aucun secret.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId, utilisateurId } = await session();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const test = await testerInstallation({ tenantId, utilisateurId }, id);
    if ("erreur" in test) {
      return Response.json({ error: test.erreur }, { status: 502 });
    }
    return Response.json({ data: { en_ligne: true } });
  } catch (e) {
    console.error("[connexion-mikhmon-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
