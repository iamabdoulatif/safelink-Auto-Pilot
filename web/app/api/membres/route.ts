import { db } from "@/lib/db";
import { listerMembres, roleDansEspace } from "@/lib/membres";
import { estRole } from "@/lib/roles";
import { reponseAuthentification, session } from "@/lib/session";

// GET : membres de l'espace courant (tout membre peut consulter,
// avec son propre rôle pour adapter l'interface).
export async function GET() {
  try {
    const ctx = await session();
    const membres = await listerMembres(ctx.tenantId);
    const monRole = await roleDansEspace(ctx.tenantId, ctx.utilisateurId);
    return Response.json({ data: { membres, monRole } });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[membres] Lecture impossible.");
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

// POST : inviter un membre. Réservé aux admins de l'espace. La
// personne peut ne pas avoir encore de compte : elle rejoint
// l'espace dès son inscription avec ce courriel.
export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  try {
    const ctx = await session();
    if ((await roleDansEspace(ctx.tenantId, ctx.utilisateurId)) !== "admin") {
      return Response.json(
        { error: "Seul un admin de l'espace peut inviter un membre." },
        { status: 403 },
      );
    }
    const courriel =
      typeof b["courriel"] === "string" ? b["courriel"].trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel) || !estRole(b["role"])) {
      return Response.json({ error: "Courriel ou rôle invalide." }, { status: 400 });
    }
    await db.query(
      `INSERT INTO membres_espace (tenant_id, courriel, role, invite_par)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, courriel)
       DO UPDATE SET role = EXCLUDED.role`,
      [ctx.tenantId, courriel, b["role"], ctx.utilisateurId],
    );
    return Response.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[membres] Invitation impossible.");
    return Response.json({ error: "Invitation impossible." }, { status: 500 });
  }
}
