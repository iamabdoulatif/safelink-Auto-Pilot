import { db } from "@/lib/db";
import { roleDansEspace } from "@/lib/membres";
import { estRole } from "@/lib/roles";
import { reponseAuthentification, session } from "@/lib/session";
import type { Session } from "@/lib/session";

// Nombre d'admins de l'espace, éventuellement sans un courriel : on
// protège le dernier admin pour ne jamais laisser un espace sans
// personne capable de le gérer.
async function nombreAdmins(tenantId: string, hors?: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM membres_espace
     WHERE tenant_id = $1 AND role = 'admin'
       AND ($2::text IS NULL OR courriel <> $2)`,
    [tenantId, hors ?? null],
  );
  return Number(rows[0]?.n ?? 0);
}

async function estAdmin(ctx: Session): Promise<boolean> {
  return (await roleDansEspace(ctx.tenantId, ctx.utilisateurId)) === "admin";
}

function erreurServeur(tag: string): Response {
  console.error(`[membres] ${tag} impossible.`);
  return Response.json({ error: `${tag} impossible.` }, { status: 500 });
}

// PATCH : changer le rôle d'un membre (admins seulement).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courriel: string }> },
) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  try {
    const ctx = await session();
    if (!(await estAdmin(ctx))) {
      return Response.json(
        { error: "Seul un admin de l'espace peut gérer les membres." },
        { status: 403 },
      );
    }
    const courriel = decodeURIComponent((await params).courriel).toLowerCase();
    if (!estRole(b["role"])) {
      return Response.json({ error: "Rôle invalide." }, { status: 400 });
    }
    if (courriel === ctx.tenantId && b["role"] !== "admin") {
      return Response.json(
        { error: "Le propriétaire de l'espace reste admin." },
        { status: 400 },
      );
    }
    const actuel = await roleDansEspace(ctx.tenantId, courriel);
    if (actuel === null) {
      return Response.json({ error: "Membre introuvable." }, { status: 404 });
    }
    if (actuel === "admin" && b["role"] !== "admin" &&
        (await nombreAdmins(ctx.tenantId, courriel)) === 0) {
      return Response.json(
        { error: "Il doit rester au moins un admin dans l'espace." },
        { status: 400 },
      );
    }
    await db.query(
      `UPDATE membres_espace SET role = $3 WHERE tenant_id = $1 AND courriel = $2`,
      [ctx.tenantId, courriel, b["role"]],
    );
    return Response.json({ data: { ok: true } });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    return erreurServeur("Changement de rôle");
  }
}

// DELETE : retirer un membre (admins seulement, jamais le
// propriétaire ni le dernier admin).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courriel: string }> },
) {
  try {
    const ctx = await session();
    if (!(await estAdmin(ctx))) {
      return Response.json(
        { error: "Seul un admin de l'espace peut gérer les membres." },
        { status: 403 },
      );
    }
    const courriel = decodeURIComponent((await params).courriel).toLowerCase();
    if (courriel === ctx.tenantId) {
      return Response.json(
        { error: "Le propriétaire ne peut pas être retiré de son espace." },
        { status: 400 },
      );
    }
    const actuel = await roleDansEspace(ctx.tenantId, courriel);
    if (actuel === "admin" && (await nombreAdmins(ctx.tenantId, courriel)) === 0) {
      return Response.json(
        { error: "Il doit rester au moins un admin dans l'espace." },
        { status: 400 },
      );
    }
    await db.query(`DELETE FROM membres_espace WHERE tenant_id = $1 AND courriel = $2`, [
      ctx.tenantId,
      courriel,
    ]);
    return Response.json({ data: { ok: true } });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    return erreurServeur("Retrait du membre");
  }
}
