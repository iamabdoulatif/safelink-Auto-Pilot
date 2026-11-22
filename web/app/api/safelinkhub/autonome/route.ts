import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { lierSansCompte, lireLiaison } from "@/lib/safelinkhub";

// POST → { organisation } : espace sans compte SafeLinkHub. Une organisation
// technique est créée côté SafeLinkHub et liée ; l'ajout par ligne collée
// devient possible. Sans effet si l'espace est déjà lié.
export async function POST() {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json({ error: "Réservé à l'administrateur de l'espace." }, { status: 403 });
  }
  const deja = await lireLiaison(tenantId).catch(() => null);
  if (deja) return Response.json({ data: { organisation: deja.organisation } });
  // Libellé lisible sans donnée personnelle : jamais l'adresse courriel.
  const { rows: [e] } = await db.query<{ affichage: string | null }>(
    "SELECT affichage FROM espaces WHERE tenant_id = $1", [tenantId]);
  const libelle = e?.affichage && !e.affichage.includes("@") ? e.affichage : "Espace Auto-Pilot";
  try {
    return Response.json({ data: { organisation: await lierSansCompte(tenantId, libelle) } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Création impossible." }, { status: 400 });
  }
}
