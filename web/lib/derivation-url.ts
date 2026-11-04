// Derivation des URL Mikhmon selon l'appelant, sans adresse en dur.
// Regle d'or : le navigateur local voit 127.0.0.1:8088, n8n sous Docker
// macOS voit host.docker.internal:8088, et un conteneur voit le nom ou
// l'adresse reelle du reseau. L'hote et le port sont TOUJOURS saisis par
// l'utilisateur (formulaire) : ce module ne fait que calculer et deriver.
// Aucune URL n'est construite depuis le navigateur : uniquement ici,
// cote serveur, pour les routes et les appels n8n.

// Qui va appeler l'URL calculee.
export type AppelantMikhmon =
  | "navigateur" // le navigateur de l'utilisateur, en local
  | "n8n-docker-mac" // n8n dans Docker Desktop macOS
  | "n8n-conteneur"; // n8n et Mikhmon dans des conteneurs (nom reseau)

// Hotes de bouclage : eux seuls sont reecrits pour n8n.
function estBouclage(hote: string): boolean {
  const h = hote.trim().toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "::1";
}

// Valide l'hote saisi : nom ou adresse, sans schema ni chemin.
export function validerHote(hote: string): string | null {
  const h = hote.trim();
  if (h.length < 1 || h.length > 253) {
    return "Hôte obligatoire (1 à 253 caractères).";
  }
  if (!/^[A-Za-z0-9._-]+$/.test(h)) {
    return "Hôte invalide : nom ou adresse IP uniquement.";
  }
  return null;
}

// Valide le port saisi : entier 1 a 65535, jamais de flottant.
export function validerPort(port: number): string | null {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "Port invalide (entier de 1 à 65535).";
  }
  return null;
}

// Calcule l'URL Mikhmon depuis l'hote et le port saisis.
// Ex. ("127.0.0.1", 8088) -> "http://127.0.0.1:8088/admin.php?id=login".
export function construireUrlMikhmon(
  hote: string,
  port: number,
): { url: string } | { erreur: string } {
  const erreurHote = validerHote(hote);
  if (erreurHote) return { erreur: erreurHote };
  const erreurPort = validerPort(port);
  if (erreurPort) return { erreur: erreurPort };
  return { url: "http://" + hote.trim() + ":" + port + "/admin.php?id=login" };
}

// Reecrit l'hote selon l'appelant. Hors bouclage, l'hote est inchange :
// seul le cas local (127.0.0.1 saisi) demande une derivation.
export function deriverHotePourAppelant(
  hote: string,
  appelant: AppelantMikhmon,
  hoteConteneur?: string,
): { hote: string } | { erreur: string } {
  const h = hote.trim();
  if (!estBouclage(h)) return { hote: h };
  if (appelant === "navigateur") return { hote: h };
  if (appelant === "n8n-docker-mac") return { hote: "host.docker.internal" };
  const reseau = (hoteConteneur ?? "").trim();
  if (!reseau) {
    return {
      erreur:
        "Nom ou adresse réseau du conteneur Mikhmon obligatoire " +
        "(conteneur à conteneur, 127.0.0.1 est injoignable).",
    };
  }
  const erreurReseau = validerHote(reseau);
  if (erreurReseau) return { erreur: erreurReseau };
  return { hote: reseau };
}

// URL complete pour un appelant donne, depuis l'hote et le port saisis.
export function deriverUrlMikhmonPourAppelant(
  hote: string,
  port: number,
  appelant: AppelantMikhmon,
  hoteConteneur?: string,
): { url: string } | { erreur: string } {
  const derive = deriverHotePourAppelant(hote, appelant, hoteConteneur);
  if ("erreur" in derive) return derive;
  return construireUrlMikhmon(derive.hote, port);
}
