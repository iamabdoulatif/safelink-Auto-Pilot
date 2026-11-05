// Lecture des reponses RouterOS (fonctions pures, testables avec node --test).
// RouterOS renvoie les nombres en texte ; la memoire reste en octets entiers.
export type Materiel = {
  modele: string | null;
  version: string | null;
  cpu: string | null;
  coeurs: number | null;
  chargeCpu: number | null;
  ramTotale: number | null;
  ramLibre: number | null;
};

type Objet = Record<string, unknown>;

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function entier(v: unknown): number | null {
  const s = texte(v);
  return s && /^\d+$/.test(s) ? Number(s) : null;
}

// Nom commercial et reference, par exemple « hAP ax lite (L41G-2axD) ». Un
// routeur virtuel n'a pas de carte RouterBOARD.
export function extraireMateriel(resource: Objet, routerboard: Objet | null): Materiel {
  const nom = texte(resource["board-name"]);
  const reference = texte(routerboard?.model);
  return {
    modele: nom && reference && nom !== reference
      ? `${nom} (${reference})`
      : (nom ?? reference),
    version: texte(resource.version),
    cpu: texte(resource.cpu),
    coeurs: entier(resource["cpu-count"]),
    chargeCpu: entier(resource["cpu-load"]),
    ramTotale: entier(resource["total-memory"]),
    ramLibre: entier(resource["free-memory"]),
  };
}

export function formaterMemoire(octets: number): string {
  const mio = 1024 * 1024;
  return octets >= 1024 * mio
    ? `${(octets / (1024 * mio)).toFixed(1).replace(".", ",")} Go`
    : `${Math.round(octets / mio)} Mo`;
}
