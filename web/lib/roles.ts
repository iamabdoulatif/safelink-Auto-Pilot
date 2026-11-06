// Rôles métier dans un espace client (version Mikhmon SafeLinkHub SF) :
// admin > gerant > vendeur.
// Logique pure, testable sans base : la hiérarchie et la validation.
// Le rôle effectif se résout côté serveur (lib/membres), jamais depuis
// une valeur fournie par le client.
// - admin   : gère tout (routeurs, canaux, membres, validations).
// - gerant  : génère, envoie et configure les règles au quotidien.
// - vendeur : consulte, et reçoit les tickets (WhatsApp) pour les vendre.
export const ROLES = ["admin", "gerant", "vendeur"] as const;
export type Role = (typeof ROLES)[number];

const NIVEAUX: Record<Role, number> = { admin: 3, gerant: 2, vendeur: 1 };

export function estRole(brut: unknown): brut is Role {
  return typeof brut === "string" && (ROLES as readonly string[]).includes(brut);
}

// Le rôle détenu suffit-il pour l'action (rôle minimum requis) ?
export function roleAutorise(detenu: Role | null, minimum: Role): boolean {
  if (!detenu) return false;
  return NIVEAUX[detenu] >= NIVEAUX[minimum];
}
