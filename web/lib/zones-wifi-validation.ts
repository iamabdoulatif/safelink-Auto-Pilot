import type { DestinataireSupplementaire } from "@/lib/destinataires-supplementaires";

// Validation pure des fiches de zone Wi-Fi (testable sans base).
// La partie base de données vit dans lib/zones-wifi.

export const MAX_VENDEURS = 5;

export type ZoneWifi = {
  routerConnectionId: number;
  routeurNom: string;
  varianteMikhmon: string;
  localisation: string;
  commune: string;
  numeroAdmin: string;
  numeroGerant: string;
  numerosVendeurs: string[];
};

export type EntreeZoneWifi = {
  localisation: string;
  commune: string;
  numeroAdmin: string;
  numeroGerant: string;
  numerosVendeurs: string[];
  rapportActif: boolean;
  rapportCanal: "telegram" | "whatsapp";
  rapportPlanification: "decade" | "hebdomadaire" | "mensuel" | "personnalise";
  rapportDebut: string;
  rapportFin: string;
  rapportDateEnvoi: string;
};

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

function champDate(brut: unknown): string | null {
  if (brut === undefined || brut === null) return "";
  if (typeof brut !== "string") return null;
  const v = brut.trim();
  if (!v) return "";
  return DATE_OK.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
}

// Nettoie un numéro : espaces, tirets et points retirés, format
// international exigé (même règle que les autres destinataires).
export function nettoyerNumero(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const numero = brut.replace(/[\s.-]/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(numero) ? numero : null;
}

function champTexte(brut: unknown, max: number): string | null {
  if (brut === undefined || brut === null) return "";
  if (typeof brut !== "string") return null;
  const valeur = brut.trim();
  return valeur.length <= max ? valeur : null;
}

function champNumero(brut: unknown): string | null {
  if (brut === undefined || brut === null) return "";
  if (typeof brut === "string" && !brut.trim()) return "";
  const numero = nettoyerNumero(brut);
  return numero;
}

// Valide le formulaire d'une zone, sans toucher à la base.
export function validerZoneWifi(
  brut: unknown,
): { zone: EntreeZoneWifi } | { erreur: string } {
  const b = (brut ?? {}) as Record<string, unknown>;
  const localisation = champTexte(b["localisation"], 200);
  const commune = champTexte(b["commune"], 120);
  if (localisation === null) {
    return { erreur: "Localisation invalide (200 caractères maximum)." };
  }
  if (commune === null) {
    return { erreur: "Commune invalide (120 caractères maximum)." };
  }
  const numeroAdmin = champNumero(b["numeroAdmin"]);
  if (numeroAdmin === null) {
    return { erreur: "Numéro WhatsApp de l'admin invalide (format international)." };
  }
  const numeroGerant = champNumero(b["numeroGerant"]);
  if (numeroGerant === null) {
    return { erreur: "Numéro WhatsApp du gérant invalide (format international)." };
  }
  const vendeursBruts = b["numerosVendeurs"];
  if (vendeursBruts !== undefined && !Array.isArray(vendeursBruts)) {
    return { erreur: "Numéros des vendeurs invalides." };
  }
  const numerosVendeurs: string[] = [];
  for (const v of (vendeursBruts ?? []) as unknown[]) {
    if (typeof v === "string" && !v.trim()) continue;
    const numero = nettoyerNumero(v);
    if (!numero) {
      return { erreur: "Numéro WhatsApp d'un vendeur invalide (format international)." };
    }
    if (!numerosVendeurs.includes(numero)) numerosVendeurs.push(numero);
  }
  if (numerosVendeurs.length > MAX_VENDEURS) {
    return { erreur: `${MAX_VENDEURS} vendeurs au maximum par zone.` };
  }
  if (!numeroAdmin && !numeroGerant && numerosVendeurs.length === 0) {
    return { erreur: "Renseignez au moins un numéro (admin, gérant ou vendeur)." };
  }
  const rapportCanal = b["rapportCanal"] === "whatsapp" ? "whatsapp" : "telegram";
  const planificationBrute = b["rapportPlanification"];
  const rapportPlanification = planificationBrute === "decade"
    || planificationBrute === "hebdomadaire"
    || planificationBrute === "mensuel" || planificationBrute === "personnalise"
    ? planificationBrute : "decade";
  const rapportDebut = champDate(b["rapportDebut"]);
  const rapportFin = champDate(b["rapportFin"]);
  const rapportDateEnvoi = champDate(b["rapportDateEnvoi"]);
  if (rapportDebut === null || rapportFin === null || rapportDateEnvoi === null) {
    return { erreur: "Dates du rapport invalides (format AAAA-MM-JJ)." };
  }
  const rapportActif = b["rapportActif"] === true;
  if (rapportActif && rapportPlanification === "personnalise"
    && (!rapportDebut || !rapportFin || rapportDebut > rapportFin)) {
    return {
      erreur: "Période personnalisée : renseignez un début et une fin cohérents.",
    };
  }
  return {
    zone: {
      localisation, commune, numeroAdmin, numeroGerant, numerosVendeurs,
      rapportActif, rapportCanal, rapportPlanification,
      rapportDebut, rapportFin, rapportDateEnvoi,
    },
  };
}

// Numéros WhatsApp d'une zone, dédupliqués, prêts pour l'envoi.
export function destinatairesZone(
  zone: Pick<EntreeZoneWifi, "numeroAdmin" | "numeroGerant" | "numerosVendeurs">,
): DestinataireSupplementaire[] {
  const vus = new Set<string>();
  const liste: DestinataireSupplementaire[] = [];
  for (const numero of [zone.numeroAdmin, zone.numeroGerant, ...zone.numerosVendeurs]) {
    if (!numero || vus.has(numero)) continue;
    vus.add(numero);
    liste.push({ canal: "whatsapp", valeur: numero });
  }
  return liste;
}

// Fusionne deux listes de destinataires sans doublon (canal + valeur).
export function fusionnerDestinataires(
  ...listes: DestinataireSupplementaire[][]
): DestinataireSupplementaire[] {
  const vus = new Set<string>();
  const fusion: DestinataireSupplementaire[] = [];
  for (const liste of listes) {
    for (const d of liste) {
      const cle = `${d.canal}:${d.valeur}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      fusion.push(d);
    }
  }
  return fusion;
}

