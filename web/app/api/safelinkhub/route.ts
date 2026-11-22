import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { delierSafelinkhub, lierSafelinkhub, routeursSafelinkhub } from "@/lib/safelinkhub";

// Import des routeurs WireGuard de SafeLinkHub (voir lib/safelinkhub.ts).
// GET : état de la liaison + routeurs ; POST { code } : lier ; DELETE : délier.
export async function GET() {
  const { tenantId } = await session();
  try {
    const res = await routeursSafelinkhub(tenantId);
    return Response.json({ data: res ? { lie: true, ...res } : { lie: false } });
  } catch (e) {
    return Response.json({ data: { lie: true }, error: e instanceof Error ? e.message : "SafeLinkHub injoignable." });
  }
}

export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json({ error: "Réservé à l'administrateur de l'espace." }, { status: 403 });
  }
  const corps = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof corps?.code === "string" ? corps.code.trim() : "";
  if (!code || code.length > 20) return Response.json({ error: "Code de liaison invalide." }, { status: 400 });
  try {
    const organisation = await lierSafelinkhub(tenantId, code);
    return Response.json({ data: { organisation } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Liaison impossible." }, { status: 400 });
  }
}

export async function DELETE() {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json({ error: "Réservé à l'administrateur de l'espace." }, { status: 403 });
  }
  await delierSafelinkhub(tenantId);
  return Response.json({ data: { lie: false } });
}
