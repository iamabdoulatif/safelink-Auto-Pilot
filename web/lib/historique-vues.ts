// Classement des runs pour l'historique : un run est SIGNIFICATIF
// s'il a créé des tickets, échoué, ou attend quelque chose. Le reste
// (contrôles toutes les 15 minutes, 0 créé, aucun échec) est de la
// routine : archivable après 30 jours. Logique pure, testable.
export type VueHistorique = "significatifs" | "controles" | "archives";

export function estSignificatif(run: {
  quantite_creee: number;
  statut: string;
  erreur: string | null;
}): boolean {
  return run.quantite_creee > 0
    || run.statut === "echoue"
    || run.statut === "en_attente"
    || run.statut === "en_cours"
    || Boolean(run.erreur);
}

export function conditionVue(vue: VueHistorique): string {
  if (vue === "archives") return "r.archive = true";
  if (vue === "controles") {
    return `r.archive = false AND r.quantite_creee = 0
      AND r.statut NOT IN ('echoue', 'en_attente', 'en_cours')
      AND r.erreur IS NULL`;
  }
  return `r.archive = false AND (r.quantite_creee > 0
    OR r.statut IN ('echoue', 'en_attente', 'en_cours') OR r.erreur IS NOT NULL)`;
}
