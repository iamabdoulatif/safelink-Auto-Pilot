// Rôles dans un espace client : admin > contributeur > utilisateur.
// Logique pure, testable sans base : la hiérarchie et la validation.
// Le rôle effectif se résout côté serveur (lib/membres), jamais depuis
// une valeur fournie par le client.
export const ROLES = ["admin", "contributeur", "utilisateur"] as const;
export type Role = (typeof ROLES)[number];

const NIVEAUX: Record<Role, number> = { admin: 3, contributeur: 2, utilisateur: 1 };

export function estRole(brut: unknown): brut is Role {
  return typeof brut === "string" && (ROLES as readonly string[]).includes(brut);
}

// Le rôle détenu suffit-il pour l'action (rôle minimum requis) ?
export function roleAutorise(detenu: Role | null, minimum: Role): boolean {
  if (!detenu) return false;
  return NIVEAUX[detenu] >= NIVEAUX[minimum];
}
