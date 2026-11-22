import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { scriptInstallation } from "@/lib/safelinkhub";

// POST { nom } → { commande } : ligne à coller dans le terminal MikroTik.
export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json({ error: "Réservé à l'administrateur de l'espace." }, { status: 403 });
  }
  const corps = (await req.json().catch(() => null)) as { nom?: unknown } | null;
  const nom = typeof corps?.nom === "string" ? corps.nom.trim() : "";
  if (nom.length < 2 || nom.length > 64) return Response.json({ error: "Nom du routeur : 2 à 64 caractères." }, { status: 400 });
  try {
    return Response.json({ data: { commande: await scriptInstallation(tenantId, nom) } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Génération impossible." }, { status: 400 });
  }
}
