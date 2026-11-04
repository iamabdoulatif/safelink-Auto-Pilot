import { validerMikhmon, testerMikhmon } from "@/lib/mikhmon";
import { rosAvecIdentifiants, ErreurRouterOS } from "@/lib/routeros";

// Champs du formulaire « Configuration du routeur », partages entre
// le bouton « Tester la connexion » (sans ecriture) et « Enregistrer ».
export type ChampsRouteur = {
  nom: string;
  variante: string;
  urlMikhmon: string;
  identifiantMikhmon: string;
  motDePasseMikhmon: string;
  adresseRouterOS: string;
  utilisateurLecture: string;
  motDePasseLecture: string;
  utilisateurCorrection: string;
  motDePasseCorrection: string;
};

// Lit et valide la forme. Ne touche jamais au reseau.
export function extraireChamps(
  corps: Record<string, unknown>,
): { champs: ChampsRouteur } | { erreur: string } {
  const texte = (k: string, max: number): string | null => {
    const v = typeof corps[k] === "string" ? corps[k].trim() : "";
    return v.length > max ? null : v;
  };
  const nom = texte("nom", 100);
  const variante = texte("variante_mikhmon", 10);
  const urlMikhmon = texte("url_mikhmon", 300);
  const identifiantMikhmon = texte("identifiant_mikhmon", 128);
  const motDePasseMikhmon =
    typeof corps["mot_de_passe_mikhmon"] === "string"
      ? (corps["mot_de_passe_mikhmon"] as string)
      : "";
  const adresseRouterOS = texte("adresse_routeros", 300);
  const utilisateurLecture = texte("utilisateur_lecture", 128);
  const motDePasseLecture =
    typeof corps["mot_de_passe_lecture"] === "string"
      ? (corps["mot_de_passe_lecture"] as string)
      : "";
  const utilisateurCorrection = texte("utilisateur_correction", 128);
  const motDePasseCorrection =
    typeof corps["mot_de_passe_correction"] === "string"
      ? (corps["mot_de_passe_correction"] as string)
      : "";

  if (!nom) {
    return { erreur: "Nom du routeur obligatoire (1 à 100 caractères)." };
  }
  const erreurMikhmon = validerMikhmon({
    variante: variante ?? "",
    url: urlMikhmon ?? "",
    identifiant: identifiantMikhmon ?? "",
    motDePasse: motDePasseMikhmon,
  });
  if (erreurMikhmon) return { erreur: erreurMikhmon };
  if (!adresseRouterOS || !/^https?:\/\/[^/\s]+(\/.*)?$/i.test(adresseRouterOS)) {
    return { erreur: "Adresse RouterOS invalide (http ou https)." };
  }
  if (!utilisateurLecture || !utilisateurCorrection) {
    return { erreur: "Les deux utilisateurs RouterOS sont obligatoires." };
  }
  if (!motDePasseLecture) {
    return { erreur: "Mot de passe RouterOS de lecture obligatoire." };
  }
  if (!motDePasseCorrection) {
    return { erreur: "Mot de passe RouterOS de correction obligatoire." };
  }
  return {
    champs: {
      nom, variante: variante as string, urlMikhmon: urlMikhmon as string,
      identifiantMikhmon: identifiantMikhmon as string, motDePasseMikhmon,
      adresseRouterOS, utilisateurLecture, motDePasseLecture,
      utilisateurCorrection,
      motDePasseCorrection,
    },
  };
}

// Preuves de vie : une lecture seule sur le routeur (GET /system/identity,
// aucune ecriture) et la page d'accueil Mikhmon. Renvoie null si tout
// repond, sinon le message a afficher. Aucun secret n'est journalise.
export async function testerConnexions(
  c: ChampsRouteur,
): Promise<string | null> {
  try {
    await rosAvecIdentifiants(
      c.adresseRouterOS, c.utilisateurLecture, c.motDePasseLecture,
    ).get("/system/identity");
  } catch (e) {
    if (e instanceof ErreurRouterOS) {
      return "Routeur injoignable ou identifiants invalides (HTTP " + e.statut + ").";
    }
    return "Test RouterOS impossible.";
  }
  try {
    await testerMikhmon(c.urlMikhmon);
  } catch (e) {
    return e instanceof Error ? e.message : "Test Mikhmon impossible.";
  }
  return null;
}
