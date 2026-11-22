import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { configurerComptesConnexion } from "@/lib/safelinkhub";

// POST { configurationId } : pose les comptes RouterOS (lecture + écriture)
// d'une connexion existante dont l'hôte est un routeur SafeLinkHub.
export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json({ error: "Réservé à l'administrateur de l'espace." }, { status: 403 });
  }
  const corps = (await req.json().catch(() => null)) as { configurationId?: unknown } | null;
  const id = Number(corps?.configurationId);
  if (!Number.isInteger(id)) return Response.json({ error: "Connexion invalide." }, { status: 400 });
  const { rows: [c] } = await db.query<{ hote: string | null }>(
    "SELECT hote FROM configurations_routeurs WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!c) return Response.json({ error: "Connexion introuvable." }, { status: 404 });
  try {
    const erreur = await configurerComptesConnexion(tenantId, id, c.hote ?? "");
    if (erreur) return Response.json({ error: erreur }, { status: 400 });
    return Response.json({ data: { configure: true } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Configuration impossible." }, { status: 502 });
  }
}
