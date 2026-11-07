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
  latitude: number | null;
  longitude: number | null;
  wifiNom: string;
  prixProfils: { profil: string; prix: number }[];
};

export const MAX_PRIX_PROFILS = 20;

function champCoordonnee(brut: unknown, min: number, max: number): number | null | undefined {
  if (brut === undefined || brut === null || brut === "") return null;
  const n = typeof brut === "number" ? brut : Number(brut);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

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
  const wifiNom = champTexte(b["wifiNom"], 100);
  if (wifiNom === null) {
    return { erreur: "Nom du Wi-Fi invalide (100 caractères maximum)." };
  }
  const prixBruts = b["prixProfils"];
  if (prixBruts !== undefined && !Array.isArray(prixBruts)) {
    return { erreur: "Prix des profils invalides." };
  }
  const prixProfils: { profil: string; prix: number }[] = [];
  for (const entree of (prixBruts ?? []) as unknown[]) {
    const e = (entree ?? {}) as Record<string, unknown>;
    const profil = typeof e["profil"] === "string" ? e["profil"].trim() : "";
    const prix = typeof e["prix"] === "number" ? e["prix"] : Number(e["prix"]);
    if (!profil || profil.length > 60) {
      return { erreur: "Nom de profil invalide dans les prix." };
    }
    if (!Number.isInteger(prix) || prix < 0 || prix > 10000000) {
      return { erreur: `Prix invalide pour ${profil} (entier entre 0 et 10 000 000).` };
    }
    if (!prixProfils.some((x) => x.profil === profil)) {
      prixProfils.push({ profil, prix });
    }
  }
  if (prixProfils.length > MAX_PRIX_PROFILS) {
    return { erreur: `${MAX_PRIX_PROFILS} prix de profils au maximum.` };
  }
  const latitude = champCoordonnee(b["latitude"], -90, 90);
  const longitude = champCoordonnee(b["longitude"], -180, 180);
  if (latitude === undefined || longitude === undefined
    || (latitude === null) !== (longitude === null)) {
    return {
      erreur: "Coordonnées invalides : latitude et longitude ensemble, dans leurs limites.",
    };
  }
  return {
    zone: {
      localisation, commune, numeroAdmin, numeroGerant, numerosVendeurs,
      latitude, longitude, wifiNom, prixProfils,
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

