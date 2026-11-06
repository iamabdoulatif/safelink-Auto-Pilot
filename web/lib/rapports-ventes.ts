// Cycles de rapport des ventes, comptés de 00h à 00h.
// Logique pure (dates ISO AAAA-MM-JJ, fuseau du serveur = UTC,
// cohérent avec Africa/Abidjan) : aucune requête ici.
//
// - decade       : du 1er 00:00 au 11 00:00 (le 1er au 10 inclus),
//                  du 11 au 21 (11 au 20), du 21 au 1er du mois
//                  suivant (21 à fin de mois). Envoi le 11, le 21
//                  et le 1er, pour le cycle qui vient de se fermer.
// - hebdomadaire : du lundi 00:00 au lundi suivant. Envoi le lundi.
// - mensuel      : du 1er 00:00 au 1er suivant. Envoi le 1er.
// - personnalise : du début au fin choisis (fin incluse à 00h le
//                  lendemain), envoi à la date d'envoi choisie.

export type PlanificationRapport =
  | "decade" | "hebdomadaire" | "mensuel" | "personnalise";

export type PeriodeRapport = { debut: string; fin: string }; // fin exclusive

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ajouterJours(dateIso: string, jours: number): string {
  const d = new Date(dateIso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + jours);
  return iso(d);
}

function premierDuMois(dateIso: string, decalageMois: number): string {
  const d = new Date(dateIso + "T00:00:00.000Z");
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + decalageMois, 1)));
}

// Le cycle terminé juste avant la date du jour (fin = borne 00:00).
export function periodePrecedente(
  planification: PlanificationRapport,
  aujourdhui: string,
  personnalisee?: PeriodeRapport,
): PeriodeRapport | null {
  const jour = Number(aujourdhui.slice(8, 10));
  if (planification === "decade") {
    if (jour === 1) {
      return { debut: premierDuMois(aujourdhui, -1).slice(0, 8) + "21", fin: aujourdhui };
    }
    if (jour === 11) return { debut: aujourdhui.slice(0, 8) + "01", fin: aujourdhui };
    if (jour === 21) return { debut: aujourdhui.slice(0, 8) + "11", fin: aujourdhui };
    return null;
  }
  if (planification === "mensuel") {
    if (jour !== 1) return null;
    return { debut: premierDuMois(aujourdhui, -1), fin: aujourdhui };
  }
  if (planification === "hebdomadaire") {
    const d = new Date(aujourdhui + "T00:00:00.000Z");
    if (d.getUTCDay() !== 1) return null; // lundi uniquement
    return { debut: ajouterJours(aujourdhui, -7), fin: aujourdhui };
  }
  return personnalisee ?? null; // personnalise : période explicite
}

// Le rapport doit-il partir aujourd'hui ?
export function rapportEstDu(
  planification: PlanificationRapport,
  aujourdhui: string,
  personnalisee?: (PeriodeRapport & { dateEnvoi: string }),
): PeriodeRapport | null {
  if (planification === "personnalise") {
    if (!personnalisee || !personnalisee.dateEnvoi) return null;
    if (aujourdhui < personnalisee.dateEnvoi) return null;
    // Période stockée début..fin incluse : borne haute = fin + 1 jour 00:00.
    return {
      debut: personnalisee.debut,
      fin: ajouterJours(personnalisee.fin, 1),
    };
  }
  return periodePrecedente(planification, aujourdhui);
}

// « du 1er au 10 novembre 2026 » pour une période [début, fin).
export function decrirePeriode(p: PeriodeRapport): string {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const finIncluse = ajouterJours(p.fin, -1);
  const d = (x: string) => ({
    jour: Number(x.slice(8, 10)), mois: mois[Number(x.slice(5, 7)) - 1],
    annee: Number(x.slice(0, 4)),
  });
  const a = d(p.debut), b = d(finIncluse);
  const jourA = a.jour === 1 ? "1er" : String(a.jour);
  if (p.debut === finIncluse) return `le ${jourA} ${a.mois} ${a.annee}`;
  if (a.mois === b.mois && a.annee === b.annee) {
    return `du ${jourA} au ${b.jour} ${a.mois} ${a.annee}`;
  }
  return `du ${jourA} ${a.mois} ${a.annee} au ${b.jour} ${b.mois} ${b.annee}`;
}

// 20000 -> « 20 000 F » (entier, jamais de flottant pour un montant).
export function formaterMontant(montant: number): string {
  return String(Math.trunc(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}
