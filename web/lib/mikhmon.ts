// Controles Mikhmon : joignabilite et refus du mot de passe initial.
// Mikhmon est une interface PHP devant le routeur : tester l'URL suffit a
// prouver qu'elle repond ; la variante (V3 ou SF v1) ne change que
// l'interface, le code qui ecrit dans /ip/hotspot/user reste identique.
export const VARIANTES_MIKHMON = ["v3", "sf-v1"] as const;

// Deux versions de Mikhmon : seule SF v1 prend en compte les
// vendeurs et le gérant (lots distincts, rapport par vendeur).
// V3 : lot unique, rapport de zone sans détail par vendeur.
export const VARIANTE_AVEC_VENDEURS = "sf-v1";
export type VarianteMikhmon = (typeof VARIANTES_MIKHMON)[number];

// Identifiants initiaux livrés par défaut : les refuser, et exiger
// un changement à la première connexion.
const IDENTIFIANT_INITIAL = "mikhmon";
const MOT_DE_PASSE_INITIAL = "1234";

export function estInitialMikhmon(
  identifiant: string,
  motDePasse: string,
): boolean {
  return (
    identifiant.trim().toLowerCase() === IDENTIFIANT_INITIAL &&
    motDePasse === MOT_DE_PASSE_INITIAL
  );
}

export type EntreeMikhmon = {
  variante: string;
  url: string;
  identifiant: string;
  motDePasse: string;
};

// Valide la forme (variante, URL, champs) sans toucher au reseau.
export function validerMikhmon(e: EntreeMikhmon): string | null {
  if (!(VARIANTES_MIKHMON as readonly string[]).includes(e.variante)) {
    return "Variante inconnue : v3 ou sf-v1.";
  }
  if (!/^https?:\/\/[^/\s]+(\/.*)?$/i.test(e.url) || e.url.length > 300) {
    return "URL Mikhmon invalide (http ou https).";
  }
  if (e.identifiant.length < 1 || e.identifiant.length > 128) {
    return "Identifiant Mikhmon obligatoire (1 à 128 caractères).";
  }
  if (e.motDePasse.length < 1 || e.motDePasse.length > 256) {
    return "Mot de passe Mikhmon obligatoire.";
  }
  if (estInitialMikhmon(e.identifiant, e.motDePasse)) {
    return "Le couple mikhmon / 1234 est interdit. Connectez-vous à Mikhmon, changez ce mot de passe, puis saisissez le nouveau ici.";
  }
  return null;
}

// Preuve de vie : la page d'accueil Mikhmon repond. Ne transmet jamais
// le mot de passe dans un journal : seule l'URL apparait en clair.
export async function testerMikhmon(url: string): Promise<void> {
  let reponse: Response;
  try {
    reponse = await fetch(url.replace(/\/$/, "") + "/", {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Mikhmon injoignable à cette URL.");
  }
  if (reponse.status >= 400) {
    throw new Error(
      "Mikhmon répond en erreur (HTTP " + reponse.status + ").",
    );
  }
}
