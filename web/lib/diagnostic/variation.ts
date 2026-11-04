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

// Regles materielles : des fonctions pures qui comparent DEUX releves.
// AUCUN appel reseau ici : on lit le JSON deja stocke, jamais le routeur.
// Chaque regle rend un constat ou null (tout va bien, ou on ne peut pas
// conclure). Un champ absent ou illisible donne toujours null : on ne
// conclut jamais sur une mesure qu'on n'a pas.

// Un releve vu par la comparaison : la date de mesure et le JSON brut.
export type ReleveCompare = {
  mesureLe: Date;
  donnees: Record<string, unknown>;
};

export type GraviteMaterielle = "critique" | "majeure" | "mineure" | "information";

export type ConstatMateriel = {
  regle: string;
  titre: string;
  gravite: GraviteMaterielle;
  categorie: "materiel";
  cible?: string;
  constat: string;
  preuve: { avant: unknown; apres: unknown; seuil: string };
};

export type RegleMaterielle = (
  avant: ReleveCompare,
  apres: ReleveCompare,
) => ConstatMateriel | null;

// L'API REST renvoie les nombres parfois en texte : on accepte les deux.
function nombre(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function objet(v: unknown): Record<string, unknown> | null {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function liste(donnees: Record<string, unknown>, cle: string) {
  const v = donnees[cle];
  return Array.isArray(v) ? v : null;
}

function ressourceDe(releve: ReleveCompare) {
  return objet(releve.donnees["system/resource"]);
}

// Duree RouterOS : "1w2d3h4m5s" ou "04:12:33". Null si illisible.
export function parseUptime(v: unknown): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const s = v.trim();
  const hms = s.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) {
    return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  }
  const m = s.match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m || m[0] === "") return null;
  const g = (i: number) => Number(m[i] ?? 0);
  return (((g(1) * 7 + g(2)) * 24 + g(3)) * 60 + g(4)) * 60 + g(5);
}

function uptimeDe(releve: ReleveCompare): number | null {
  return parseUptime(ressourceDe(releve)?.["uptime"]);
}

// True si le routeur a redemarre entre les deux releves, false sinon,
// null quand on ne peut pas le savoir (uptime absent).
function aRedemarre(avant: ReleveCompare, apres: ReleveCompare): boolean | null {
  const u1 = uptimeDe(avant);
  const u2 = uptimeDe(apres);
  if (u1 === null || u2 === null) return null;
  return u2 < u1;
}

function minutesEntre(avant: ReleveCompare, apres: ReleveCompare): number {
  return (apres.mesureLe.getTime() - avant.mesureLe.getTime()) / 60000;
}

function entreeParNom(
  lignes: unknown,
  nom: string,
): Record<string, unknown> | null {
  if (!Array.isArray(lignes)) return null;
  for (const l of lignes) {
    const o = objet(l);
    if (o && String(o["name"] ?? "") === nom) return o;
  }
  return null;
}

export const redemarrageSpontane: RegleMaterielle = (avant, apres) => {
  const u1 = uptimeDe(avant);
  const u2 = uptimeDe(apres);
  if (u1 === null || u2 === null) return null;
  if (u2 >= u1) return null;
  return {
    regle: "materiel.redemarrage-spontane",
    titre: "Redemarrage spontane detecte",
    gravite: "critique",
    categorie: "materiel",
    constat: "Le routeur a redemarre entre les deux releves : le service a "
      + "ete coupe. Si cela se repete, suspecter l'alimentation, la chaleur "
      + "ou un routeur instable.",
    preuve: { avant: u1, apres: u2, seuil: "uptime croissant" },
  };
};

export const fcsCroissantes: RegleMaterielle = (avant, apres) => {
  const u1 = uptimeDe(avant);
  const u2 = uptimeDe(apres);
  if (u1 === null || u2 === null || u2 < u1) return null;
  const minutes = minutesEntre(avant, apres);
  if (minutes < 1) return null;
  const lignesApres = liste(apres.donnees, "interface/ethernet:stats");
  const lignesAvant = liste(avant.donnees, "interface/ethernet:stats");
  if (!lignesApres || !lignesAvant) return null;
  for (const ligne of lignesApres) {
    const o = objet(ligne);
    const nom = o ? String(o["name"] ?? "") : "";
    if (!nom) continue;
    const compteur = entreeParNom(lignesAvant, nom);
    const taux = variationParMinute(
      {
        valeur: compteur ? nombre(compteur["rx-fcs-error"]) : null,
        uptimeSec: u1,
        mesureLe: avant.mesureLe,
      },
      {
        valeur: o ? nombre(o["rx-fcs-error"]) : null,
        uptimeSec: u2,
        mesureLe: apres.mesureLe,
      },
    );
    if (taux === null || taux <= 0) continue;
    if (taux <= 10) {
      return {
        regle: "materiel.fcs-croissantes",
        titre: "Erreurs FCS sur " + nom,
        gravite: "mineure",
        categorie: "materiel",
        cible: nom,
        constat: nom + " accumule des erreurs FCS : cable, connecteur ou "
          + "perturbation a surveiller.",
        preuve: { avant: compteur?.["rx-fcs-error"] ?? null,
          apres: o?.["rx-fcs-error"] ?? null, seuil: "1 a 10 erreurs/min" },
      };
    }
    return {
      regle: "materiel.fcs-croissantes",
      titre: "Erreurs FCS elevees sur " + nom,
      gravite: "majeure",
      categorie: "materiel",
      cible: nom,
      constat: nom + " accumule beaucoup d'erreurs FCS : cable defectueux, "
        + "port fatigue ou duplex incoherent, a traiter.",
      preuve: { avant: compteur?.["rx-fcs-error"] ?? null,
        apres: o?.["rx-fcs-error"] ?? null, seuil: "> 10 erreurs/min" },
    };
  }
  return null;
};

export const linkDownsRepetes: RegleMaterielle = (avant, apres) => {
  const u1 = uptimeDe(avant);
  const u2 = uptimeDe(apres);
  if (u1 === null || u2 === null || u2 < u1) return null;
  const minutes = minutesEntre(avant, apres);
  if (minutes < 60) return null; // trop court pour parler de 24 h
  const lignesApres = liste(apres.donnees, "interface");
  const lignesAvant = liste(avant.donnees, "interface");
  if (!lignesApres || !lignesAvant) return null;
  for (const ligne of lignesApres) {
    const o = objet(ligne);
    const nom = o ? String(o["name"] ?? "") : "";
    if (!nom) continue;
    const compteur = entreeParNom(lignesAvant, nom);
    const v1 = compteur ? nombre(compteur["link-downs"]) : null;
    const v2 = o ? nombre(o["link-downs"]) : null;
    if (v1 === null || v2 === null || v2 < v1) continue;
    const par24h = ((v2 - v1) * 1440) / minutes;
    if (par24h < 2) continue;
    const grave = par24h > 5;
    return {
      regle: "materiel.link-downs-repetes",
      titre: "Coupures repetees sur " + nom,
      gravite: grave ? "majeure" : "mineure",
      categorie: "materiel",
      cible: nom,
      constat: nom + " a coupe " + String(v2 - v1) + " fois entre les deux "
        + "releves : cable, port ou equipement distant instable.",
      preuve: { avant: v1, apres: v2, seuil: grave ? "> 5 / 24 h" : "2 a 5 / 24 h" },
    };
  }
  return null;
};

function temperatureDe(releve: ReleveCompare): number | null {
  const sante = releve.donnees["system/health"];
  if (Array.isArray(sante)) {
    for (const e of sante) {
      const o = objet(e);
      if (o && /temp/i.test(String(o["name"] ?? ""))) {
        const t = nombre(o["value"] ?? o["temperature"]);
        if (t !== null) return t;
      }
    }
    return null;
  }
  const o = objet(sante);
  if (o) {
    const t = nombre(o["temperature"] ?? o["temp"]);
    if (t !== null) return t;
  }
  return null;
}

export const temperatureHaute: RegleMaterielle = (avant, apres) => {
  const t = temperatureDe(apres);
  if (t === null) return null;
  void avant;
  if (t < 60) return null;
  const grave = t > 70;
  return {
    regle: "materiel.temperature-haute",
    titre: "Temperature elevee du routeur",
    gravite: grave ? "majeure" : "mineure",
    categorie: "materiel",
    constat: "Le routeur chauffe (" + String(t) + " C) : aeration, "
      + "poussiere ou charge a verifier avant la coupure thermique.",
    preuve: { avant: temperatureDe(avant), apres: t,
      seuil: grave ? "> 70 C" : "60 a 70 C" },
  };
};

export const memoireFaible: RegleMaterielle = (avant, apres) => {
  const res = ressourceDe(apres);
  const libre = res ? nombre(res["free-memory"]) : null;
  const total = res ? nombre(res["total-memory"]) : null;
  if (libre === null || total === null || total <= 0) return null;
  void avant;
  const pct = (libre / total) * 100;
  if (pct >= 25) return null;
  const grave = pct < 10;
  return {
    regle: "materiel.memoire-faible",
    titre: "Memoire presque pleine",
    gravite: grave ? "majeure" : "mineure",
    categorie: "materiel",
    constat: "Il reste " + String(Math.round(pct)) + " % de memoire libre : "
      + "au bout, le routeur fige ou redemarre.",
    preuve: { avant: ressourceDe(avant)?.["free-memory"] ?? null,
      apres: libre, seuil: grave ? "< 10 % libre" : "10 a 25 % libre" },
  };
};

export const badBlocksCroissants: RegleMaterielle = (avant, apres) => {
  const r1 = ressourceDe(avant);
  const r2 = ressourceDe(apres);
  const b1 = r1 ? nombre(r1["bad-blocks"]) : null;
  const b2 = r2 ? nombre(r2["bad-blocks"]) : null;
  if (b1 === null || b2 === null) return null;
  if (aRedemarre(avant, apres) !== false) return null;
  if (b2 <= b1) return null;
  return {
    regle: "materiel.bad-blocks-croissants",
    titre: "Secteurs defectueux en hausse",
    gravite: "majeure",
    categorie: "materiel",
    constat: "La memoire flash marque des secteurs defectueux : usure "
      + "irreversible, prevoir le remplacement avant la panne.",
    preuve: { avant: b1, apres: b2, seuil: "aucune augmentation toleree" },
  };
};
