import { db } from "@/lib/db";

// Accès base des membres d'espace. La logique pure (hiérarchie,
// validation) vit dans lib/roles ; le rôle effectif se résout ici,
// côté serveur, depuis la session.
import { estRole, roleAutorise } from "@/lib/roles";
import type { Role } from "@/lib/roles";
export type { Role } from "@/lib/roles";

// Rôle d'un courriel dans un espace. Repli : le propriétaire de
// l'espace (tenant = son courriel) est admin, même sans ligne membre
// (comptes créés avant les rôles). null = pas membre du tout.
export async function roleDansEspace(
  tenantId: string,
  courriel: string,
): Promise<Role | null> {
  const { rows } = await db.query<{ role: string }>(
    `SELECT role FROM membres_espace WHERE tenant_id = $1 AND courriel = $2`,
    [tenantId, courriel],
  );
  if (rows.length > 0 && estRole(rows[0].role)) return rows[0].role;
  return tenantId === courriel ? "admin" : null;
}

// Garde des routes mutantes : vrai si la session peut agir au niveau
// demandé dans son espace courant.
export async function peutAgir(
  ctx: { tenantId: string; utilisateurId: string },
  minimum: Role,
): Promise<boolean> {
  return roleAutorise(await roleDansEspace(ctx.tenantId, ctx.utilisateurId), minimum);
}

export type Membre = {
  courriel: string;
  role: Role;
  invitePar: string | null;
  depuis: Date | string;
  compteExiste: boolean;
};

export async function listerMembres(tenantId: string): Promise<Membre[]> {
  const { rows } = await db.query<{
    courriel: string;
    role: string;
    invite_par: string | null;
    created_at: Date | string;
    compte: boolean;
  }>(
    `SELECT m.courriel, m.role, m.invite_par, m.created_at,
       EXISTS (SELECT 1 FROM utilisateurs u WHERE u.courriel = m.courriel) AS compte
     FROM membres_espace m WHERE m.tenant_id = $1
     ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'gerant' THEN 1 ELSE 2 END, m.courriel`,
    [tenantId],
  );
  return rows
    .filter((r) => estRole(r.role))
    .map((r) => ({
      courriel: r.courriel,
      role: r.role as Role,
      invitePar: r.invite_par,
      depuis: r.created_at,
      compteExiste: r.compte,
    }));
}

export type EspaceMembre = { tenantId: string; role: Role };

// Espaces auxquels un courriel appartient (le sien + ceux où il est
// invité), pour le sélecteur d'espace.
export async function listerEspacesDe(courriel: string): Promise<EspaceMembre[]> {
  const { rows } = await db.query<{ tenant_id: string; role: string }>(
    `SELECT tenant_id, role FROM membres_espace WHERE courriel = $1 ORDER BY tenant_id`,
    [courriel],
  );
  const espaces = rows
    .filter((r) => estRole(r.role))
    .map((r) => ({ tenantId: r.tenant_id, role: r.role as Role }));
  if (!espaces.some((e) => e.tenantId === courriel)) {
    espaces.unshift({ tenantId: courriel, role: "admin" });
  }
  return espaces;
}
