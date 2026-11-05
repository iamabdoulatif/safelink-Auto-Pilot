// Superadmin de la plateforme : la liste des courriels autorisés vient
// de l'environnement serveur (SUPERADMIN_COURRIELS, séparés par des
// virgules). Aucun rôle n'est stocké en base ni lu depuis le client :
// sans variable configurée, personne n'est superadmin.
type Environnement = { SUPERADMIN_COURRIELS?: string };

export function courrielsSuperAdmin(env: Environnement = process.env as Environnement): string[] {
  return (env.SUPERADMIN_COURRIELS ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

export function estSuperAdmin(
  courriel: string,
  env: Environnement = process.env as Environnement,
): boolean {
  return courrielsSuperAdmin(env).includes(courriel.trim().toLowerCase());
}
