import { db } from "@/lib/db";
import { verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { chiffrer, dechiffrer } from "@/lib/chiffrement-serveur";
import { rosAvecIdentifiants, ErreurRouterOS } from "@/lib/routeros";

// Connexion RouterOS : la partie routeur d'une configuration (meme table
// que les installations Mikhmon, mais champs separes a l'ecran).
// Lecture (diagnostic) = compte ROUTEROS_USER, ecriture (correctifs) =
// compte ROUTEROS_FIX_USER, uniquement apres validation humaine.
// Tout le reseau vers le routeur passe par lib/routeros.ts.

// Profils Hotspot tels que RouterOS les renvoie.
export type ProfilHotspot = {
  nom: string;
  serveur: string | null;
};

export type ConnexionRouteur = {
  configurationId: number;
  nom: string;
  adresseRouterOS: string;
  utilisateurLecture: string;
  utilisateurCorrection: string;
  serveurHotspot: string | null;
  statutConnexion: string;
  dernierTestLe: string | null;
  correctionConfiguree: boolean; // mot de passe de correction renseigne
};

export type EntreeRouteur = {
  adresseRouterOS: string;
  utilisateurLecture: string;
  motDePasseLecture: string; // utilise pour le test, jamais stocke
  utilisateurCorrection: string;
  motDePasseCorrection: string; // chiffre en base, jamais reaffiche
  serveurHotspot: string;
};

type Ligne = {
  id: number;
  nom: string;
  adresse_routeros: string;
  utilisateur_lecture: string;
  utilisateur_correction: string;
  mot_de_passe_correction_chiffre: string;
  serveur_hotspot: string | null;
  statut_connexion: string;
  dernier_test_le: string | null;
};

// Valide la forme, sans toucher au reseau.
export function validerEntreeRouteur(
  e: EntreeRouteur,
): string | null {
  if (
    !e.adresseRouterOS.trim() ||
    !/^https?:\/\/[^/\s]+(\/.*)?$/i.test(e.adresseRouterOS.trim()) ||
    e.adresseRouterOS.trim().length > 300
  ) {
    return "Adresse RouterOS invalide (http ou https).";
  }
  if (!e.utilisateurLecture.trim() || !e.utilisateurCorrection.trim()) {
    return "Les deux utilisateurs RouterOS sont obligatoires.";
  }
  if (e.utilisateurLecture.trim().length > 128) {
    return "Utilisateur de lecture trop long (128 caractères maximum).";
  }
  if (e.utilisateurCorrection.trim().length > 128) {
    return "Utilisateur de correction trop long (128 caractères maximum).";
  }
  if (!e.motDePasseCorrection) {
    return "Mot de passe RouterOS de correction obligatoire.";
  }
  if (e.motDePasseCorrection.length > 256) {
    return "Mot de passe de correction trop long.";
  }
  if (e.serveurHotspot.length > 100) {
    return "Nom du serveur Hotspot trop long (100 caractères maximum).";
  }
  return null;
}

// Lit la partie RouterOS d'une configuration de l'espace.
export async function lireConnexionRouteur(
  ctx: ContexteTenant,
  configurationId: number,
): Promise<ConnexionRouteur | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT id, nom, adresse_routeros, utilisateur_lecture,
       utilisateur_correction, mot_de_passe_correction_chiffre,
       serveur_hotspot, statut_connexion, dernier_test_le
     FROM configurations_routeurs
     WHERE id = $1 AND tenant_id = $2`,
    [configurationId, ctx.tenantId],
  );
  const lignes = rows as Ligne[];
  if (lignes.length === 0) return null;
  const l = lignes[0];
  return {
    configurationId: l.id,
    nom: l.nom,
    adresseRouterOS: l.adresse_routeros,
    utilisateurLecture: l.utilisateur_lecture,
    utilisateurCorrection: l.utilisateur_correction,
    serveurHotspot: l.serveur_hotspot,
    statutConnexion: l.statut_connexion,
    dernierTestLe: l.dernier_test_le,
    correctionConfiguree: l.mot_de_passe_correction_chiffre.length > 0,
  };
}

// Enregistre la partie RouterOS (mots de passe chiffres, jamais
// reaffiches). Le mot de passe de lecture sert aux lectures serveur
// (tests, profils, stocks) ; celui de correction aux ecritures validees.
export async function enregistrerConnexionRouteur(
  ctx: ContexteTenant,
  configurationId: number,
  e: EntreeRouteur,
): Promise<{ connexion: ConnexionRouteur } | { erreur: string }> {
  verifierContexte(ctx);
  const invalide = validerEntreeRouteur(e);
  if (invalide) return { erreur: invalide };
  const { rows } = await db.query(
    `UPDATE configurations_routeurs
     SET adresse_routeros=$3, utilisateur_lecture=$4,
         utilisateur_correction=$5,
         mot_de_passe_correction_chiffre=$6, serveur_hotspot=$7,
         mot_de_passe_lecture_chiffre =
           CASE WHEN $8::text IS NULL THEN mot_de_passe_lecture_chiffre
           ELSE $8::text END,
         updated_at=now()
     WHERE id=$1 AND tenant_id=$2
     RETURNING id, nom, adresse_routeros, utilisateur_lecture,
       utilisateur_correction, mot_de_passe_correction_chiffre,
       serveur_hotspot, statut_connexion, dernier_test_le`,
    [
      configurationId,
      ctx.tenantId,
      e.adresseRouterOS.trim(),
      e.utilisateurLecture.trim(),
      e.utilisateurCorrection.trim(),
      chiffrer(e.motDePasseCorrection),
      e.serveurHotspot.trim() || null,
      e.motDePasseLecture ? chiffrer(e.motDePasseLecture) : null,
    ],
  );
  const lignes = rows as Ligne[];
  if (lignes.length === 0) return { erreur: "Configuration introuvable." };
  const l = lignes[0];
  return {
    connexion: {
      configurationId: l.id,
      nom: l.nom,
      adresseRouterOS: l.adresse_routeros,
      utilisateurLecture: l.utilisateur_lecture,
      utilisateurCorrection: l.utilisateur_correction,
      serveurHotspot: l.serveur_hotspot,
      statutConnexion: l.statut_connexion,
      dernierTestLe: l.dernier_test_le,
      correctionConfiguree: true,
    },
  };
}

// Teste la connexion COTE SERVEUR avec le compte de lecture seule.
// En cas d'echec, seul le statut HTTP est memorise, jamais le secret.
export async function testerConnexionRouteur(
  ctx: ContexteTenant,
  configurationId: number,
  motDePasseLecture: string,
): Promise<{ version: string } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT adresse_routeros, utilisateur_lecture
     FROM configurations_routeurs WHERE id=$1 AND tenant_id=$2`,
    [configurationId, ctx.tenantId],
  );
  const lignes = rows as {
    adresse_routeros: string;
    utilisateur_lecture: string;
  }[];
  if (lignes.length === 0) return { erreur: "Configuration introuvable." };
  if (!lignes[0].adresse_routeros || !lignes[0].utilisateur_lecture) {
    return { erreur: "Adresse ou utilisateur de lecture non renseigné." };
  }
  let ressources: { version?: unknown }[];
  try {
    const client = rosAvecIdentifiants(
      lignes[0].adresse_routeros,
      lignes[0].utilisateur_lecture,
      motDePasseLecture,
    );
    ressources = await client.get<{ version?: unknown }[]>(
      "/system/resource",
    );
  } catch (e) {
    await db.query(
      "UPDATE configurations_routeurs SET statut_connexion='hors-ligne', " +
        "dernier_test_le=now(), updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2",
      [configurationId, ctx.tenantId],
    );
    if (e instanceof ErreurRouterOS) {
      return { erreur: "RouterOS répond en erreur (HTTP " + e.statut + ")." };
    }
    return { erreur: "Routeur injoignable à cette adresse." };
  }
  await db.query(
    "UPDATE configurations_routeurs SET statut_connexion='en-ligne', " +
      "dernier_test_le=now(), updated_at=now() " +
      "WHERE id=$1 AND tenant_id=$2",
    [configurationId, ctx.tenantId],
  );
  const version =
    Array.isArray(ressources) && typeof ressources[0]?.version === "string"
      ? (ressources[0].version as string)
      : "inconnue";
  return { version };
}

// Liste les profils utilisateur Hotspot disponibles
// (/ip/hotspot/user/profile, lecture). Ce sont les profils attendus par la
// génération de tickets et par le catalogue Telegram.
export async function listerProfilsHotspot(
  ctx: ContexteTenant,
  configurationId: number,
  motDePasseLecture: string,
): Promise<{ profils: ProfilHotspot[] } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT adresse_routeros, utilisateur_lecture
     FROM configurations_routeurs WHERE id=$1 AND tenant_id=$2`,
    [configurationId, ctx.tenantId],
  );
  const lignes = rows as {
    adresse_routeros: string;
    utilisateur_lecture: string;
  }[];
  if (lignes.length === 0) return { erreur: "Configuration introuvable." };
  try {
    const client = rosAvecIdentifiants(
      lignes[0].adresse_routeros,
      lignes[0].utilisateur_lecture,
      motDePasseLecture,
    );
    const brut = await client.get<Record<string, unknown>[]>(
      "/ip/hotspot/user/profile",
    );
    const profils = (Array.isArray(brut) ? brut : [])
      .filter(
        (p): p is Record<string, unknown> => typeof p === "object" && p !== null,
      )
      .map((p) => ({
        nom: typeof p.name === "string" ? p.name : "sans-nom",
        serveur:
          typeof p.server === "string"
            ? p.server
            : null,
      }));
    return { profils };
  } catch (e) {
    if (e instanceof ErreurRouterOS) {
      return { erreur: "RouterOS répond en erreur (HTTP " + e.statut + ")." };
    }
    return { erreur: "Profils illisibles : routeur injoignable." };
  }
}

// Dechiffre le mot de passe de lecture (serveur uniquement, pour les
// lectures : tests, profils, stocks). Jamais expose ni journalise.
export async function lireMotDePasseLecture(
  ctx: ContexteTenant,
  configurationId: number,
): Promise<string | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT mot_de_passe_lecture_chiffre
     FROM configurations_routeurs WHERE id=$1 AND tenant_id=$2`,
    [configurationId, ctx.tenantId],
  );
  const lignes = rows as { mot_de_passe_lecture_chiffre: string | null }[];
  if (lignes.length === 0 || !lignes[0].mot_de_passe_lecture_chiffre) {
    return null;
  }
  try {
    const clair = dechiffrer(lignes[0].mot_de_passe_lecture_chiffre);
    return clair === "" ? null : clair;
  } catch {
    return null;
  }
}

// Dechiffre le mot de passe de correction (serveur uniquement, pour le
// workflow n8n et les correctifs valides). Jamais expose ni journalise.
export async function lireMotDePasseCorrection(
  ctx: ContexteTenant,
  configurationId: number,
): Promise<string | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT mot_de_passe_correction_chiffre
     FROM configurations_routeurs WHERE id=$1 AND tenant_id=$2`,
    [configurationId, ctx.tenantId],
  );
  const lignes = rows as { mot_de_passe_correction_chiffre: string }[];
  if (lignes.length === 0) return null;
  try {
    const clair = dechiffrer(lignes[0].mot_de_passe_correction_chiffre);
    return clair === "" ? null : clair;
  } catch {
    return null;
  }
}
