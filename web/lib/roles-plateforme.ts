// Rôles de la plateforme, au-dessus des rôles d'espace :
// - superadmin : défini par l'environnement serveur
//   (SUPERADMIN_COURRIELS), jamais stocké ni attribuable ici ;
// - admin : attribué en base par le superadmin, supervise les
//   utilisateurs mais ne règle pas la plateforme ;
// - contributeur : tout compte ordinaire (défaut).
// Logique pure : les accès base vivent dans admin-utilisateurs.
export const ROLES_PLATEFORME = ["superadmin", "admin", "contributeur"] as const;
export type RolePlateforme = (typeof ROLES_PLATEFORME)[number];

// Rôles attribuables en base (le superadmin n'en fait pas partie).
export const ROLES_ATTRIBUABLES = ["admin", "contributeur"] as const;
export type RoleAttribuable = (typeof ROLES_ATTRIBUABLES)[number];

export function estRoleAttribuable(brut: unknown): brut is RoleAttribuable {
  return (
    typeof brut === "string" &&
    (ROLES_ATTRIBUABLES as readonly string[]).includes(brut)
  );
}

// Le superadmin écrase le rôle stocké : il vient de l'environnement.
export function roleEffectif(
  estSuper: boolean,
  stocke: string | null | undefined,
): RolePlateforme {
  if (estSuper) return "superadmin";
  return stocke === "admin" ? "admin" : "contributeur";
}

// Retrait définitif d'un compte : superadmin uniquement, cible
// contributeur uniquement, jamais soi-même (« sauf le admin » : ni
// le superadmin ni un admin ne peuvent être retirés).
export function peutRetirer(
  roleActeur: RolePlateforme,
  roleCible: RolePlateforme,
  estSoiMeme: boolean,
): boolean {
  if (estSoiMeme) return false;
  return roleActeur === "superadmin" && roleCible === "contributeur";
}

// Attribution d'un rôle : superadmin uniquement, vers admin ou
// contributeur, et jamais sur le compte d'un superadmin.
export function peutAttribuer(
  roleActeur: RolePlateforme,
  roleCible: RolePlateforme,
  nouveau: string,
): boolean {
  if (roleActeur !== "superadmin") return false;
  if (roleCible === "superadmin") return false;
  return estRoleAttribuable(nouveau);
}
