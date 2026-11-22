import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { synchroniserParc } from "@/lib/safelinkhub";

// POST → { ajoutes, misAJour, erreurs } : reconnaissance des routeurs SafeLinkHub.
export async function POST() {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json({ error: "Réservé à l'administrateur de l'espace." }, { status: 403 });
  }
  try {
    return Response.json({ data: await synchroniserParc(tenantId) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Synchronisation impossible." }, { status: 400 });
  }
}
