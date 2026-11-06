import {
  attribuerRolePlateforme,
  retirerUtilisateur,
  rolePlateformeDe,
} from "@/lib/admin-utilisateurs";
import {
  estRoleAttribuable,
  peutAttribuer,
  peutRetirer,
  roleEffectif,
} from "@/lib/roles-plateforme";
import { reponseAuthentification, session } from "@/lib/session";
import { estSuperAdmin } from "@/lib/superadmin";

// Gestion des comptes par le superadmin : attribution des rôles de
// plateforme (admin / contributeur) et retrait définitif d'un compte
// contributeur. Ni le superadmin ni un admin ne peuvent être retirés,
// et le rôle d'un superadmin (environnement) ne se modifie pas.
async function contexteSuperAdmin() {
  const ctx = await session();
  return { ctx, superAdmin: estSuperAdmin(ctx.utilisateurId) };
}

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
    const { superAdmin } = await contexteSuperAdmin();
    const roleActeur = roleEffectif(superAdmin, "contributeur");
    const courriel = decodeURIComponent((await params).courriel).toLowerCase();
    const roleCible = await rolePlateformeDe(courriel);
    if (roleCible === null) {
      return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }
    if (!estRoleAttribuable(b["role"]) ||
        !peutAttribuer(roleActeur, roleCible, b["role"])) {
      return Response.json(
        { error: "Attribution de rôle non autorisée." },
        { status: 403 },
      );
    }
    await attribuerRolePlateforme(courriel, b["role"]);
    return Response.json({ data: { ok: true, role: b["role"] } });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[admin-utilisateurs] Attribution impossible.");
    return Response.json({ error: "Attribution impossible." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courriel: string }> },
) {
  try {
    const { ctx, superAdmin } = await contexteSuperAdmin();
    const roleActeur = roleEffectif(superAdmin, "contributeur");
    const courriel = decodeURIComponent((await params).courriel).toLowerCase();
    const roleCible = await rolePlateformeDe(courriel);
    if (roleCible === null) {
      return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }
    if (!peutRetirer(roleActeur, roleCible, courriel === ctx.utilisateurId)) {
      return Response.json(
        {
          error:
            "Retrait non autorisé : seul le superadmin retire un compte, et jamais un superadmin ni un admin.",
        },
        { status: 403 },
      );
    }
    await retirerUtilisateur(courriel);
    return Response.json({ data: { ok: true } });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[admin-utilisateurs] Retrait impossible.");
    return Response.json({ error: "Retrait impossible." }, { status: 500 });
  }
}
