// Calcule la variation d'un compteur entre deux releves.
// Renvoie null quand la comparaison n'a pas de sens : c'est le cas le plus
// important de cette fonction, et celui qu'on oublie toujours.
export type Point = { valeur: number | null; uptimeSec: number; mesureLe: Date };
export function variationParMinute(avant: Point, apres: Point): number | null {
if (avant.valeur == null || apres.valeur == null) return null; // champ absent
if (apres.uptimeSec < avant.uptimeSec) return null; // redemarrage
if (apres.valeur < avant.valeur) return null; // compteur remis a zero
const minutes = (apres.mesureLe.getTime() - avant.mesureLe.getTime()) / 60000;
if (minutes < 1) return null; // trop rapproche
return (apres.valeur - avant.valeur) / minutes;
}