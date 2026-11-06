import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  lireConfigPrintNode,
  testerImprimante,
  lireClePrintNode,
} from "@/lib/printnode";

// Re-teste la cle et l'imprimante COTE SERVEUR (liste PrintNode reelle).
export async function POST() {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const ctx = { tenantId, utilisateurId };
  try {
    const config = await lireConfigPrintNode(ctx);
    if (!config || config.printerId === null) {
      return Response.json({ error: "PrintNode non configuré." },
        { status: 404 });
    }
    const cle = await lireClePrintNode(ctx);
    if (!cle) {
      return Response.json({ error: "Clé illisible : reconfigurez-la." },
        { status: 500 });
    }
    const test = await testerImprimante(cle, config.printerId);
    if ("erreur" in test) {
      return Response.json({ error: test.erreur }, { status: 502 });
    }
    return Response.json({
      data: { en_ligne: true, imprimante: test.nom },
    });
  } catch (e) {
    console.error("[config-printnode-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
