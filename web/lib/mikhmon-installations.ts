import { db } from "@/lib/db";
import { assurerEspace, verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { chiffrer } from "@/lib/chiffrement-serveur";
import { construireUrlMikhmon } from "@/lib/derivation-url";
import { estInitialMikhmon, testerMikhmon } from "@/lib/mikhmon";
import type { VarianteMikhmon } from "@/lib/mikhmon";

// Installations Mikhmon : une ligne de configurations_routeurs par
// installation, isolee par tenant. Le mot de passe est chiffre (AES-256-GCM)
// et n'est JAMAIS renvoye au navigateur : la lecture expose seulement un
// statut et une date de test. Mikhmon n'a AUCUNE API REST exploitable :
// les tickets sont crees sur RouterOS (/ip/hotspot/user) et sont visibles
// automatiquement dans Mikhmon.

// Message affiché quand le nom existe déjà (contrainte UNIQUE sur
// tenant_id et nom) : il guide vers le bouton Modifier au lieu du doublon.
export const MESSAGE_CONNEXION_EXISTANTE =
  "Cette connexion existe déjà. Cliquez sur Modifier dans la liste existante.";

// Détecte la violation de la contrainte UNIQUE (tenant_id, nom).
function estViolationUnicite(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  if (code === "23505") return true;
  const message = (e as { message?: unknown }).message;
  return (
    typeof message === "string" &&
    (message.includes("duplicate") || message.includes("unique"))
  );
}

// Role affiche dans le formulaire.
export const ROLES_MIKHMON = [
  "Administrateur",
  "Gerant",
  "Vendeur",
] as const;
export type RoleMikhmon = (typeof ROLES_MIKHMON)[number];

// Statut de connexion affiche (pastille + texte).
export type StatutConnexion =
  | "jamais-teste"
  | "en-ligne"
  | "hors-ligne"
  | "erreur";

export type InstallationMikhmon = {
  id: number;
  nom: string;
  variante: VarianteMikhmon;
  hote: string | null;
  port: number;
  url: string; // URL calculee (hote + port) ou url_mikhmon historique
  role: RoleMikhmon;
  identifiant: string;
  statutConnexion: StatutConnexion;
  dernierTestLe: string | null;
  changementRequis: boolean; // true tant que mikhmon/1234 n'est pas change
  actif: boolean;
};

export type EntreeInstallation = {
  nom: string;
  variante: string;
  hote: string;
  port: number;
  role: string;
  identifiant: string;
  motDePasse: string;
};

type Ligne = {
  id: number;
  nom: string;
  variante_mikhmon: string;
  hote: string | null;
  port: number;
  url_mikhmon: string;
  role: string;
  identifiant_mikhmon: string;
  statut_connexion: string;
  dernier_test_le: string | null;
  mikhmon_change_requis: boolean;
  actif: boolean;
};

// Convertit une ligne SQL en objet metier, sans aucun secret.
function versInstallation(l: Ligne): InstallationMikhmon {
  const calcule = l.hote
    ? construireUrlMikhmon(l.hote, l.port)
    : null;
  const url =
    calcule && "url" in calcule ? calcule.url : l.url_mikhmon;
  const variante =
    l.variante_mikhmon === "sf-v1" ? "sf-v1" : "v3";
  const role = (ROLES_MIKHMON as readonly string[]).includes(l.role)
    ? (l.role as RoleMikhmon)
    : "Administrateur";
  const statuts: readonly string[] = [
    "jamais-teste",
    "en-ligne",
    "hors-ligne",
    "erreur",
  ];
  return {
    id: l.id,
    nom: l.nom,
    variante,
    hote: l.hote,
    port: l.port,
    url,
    role,
    identifiant: l.identifiant_mikhmon,
    statutConnexion: (statuts.includes(l.statut_connexion)
      ? l.statut_connexion
      : "jamais-teste") as StatutConnexion,
    dernierTestLe: l.dernier_test_le,
    changementRequis: l.mikhmon_change_requis,
    actif: l.actif,
  };
}

// Valide la forme du formulaire, sans toucher au reseau.
export function validerEntree(
  e: EntreeInstallation,
): { url: string } | { erreur: string } {
  if (!e.nom.trim() || e.nom.trim().length > 100) {
    return { erreur: "Nom d'installation obligatoire (1 à 100 caractères)." };
  }
  if (e.variante !== "v3" && e.variante !== "sf-v1") {
    return { erreur: "Variante inconnue : V3 ou SF-v1." };
  }
  if (!(ROLES_MIKHMON as readonly string[]).includes(e.role)) {
    return { erreur: "Rôle inconnu : Administrateur, Gérant ou Vendeur." };
  }
  if (!e.identifiant.trim() || e.identifiant.trim().length > 128) {
    return { erreur: "Identifiant obligatoire (1 à 128 caractères)." };
  }
  if (!e.motDePasse || e.motDePasse.length > 256) {
    return { erreur: "Mot de passe obligatoire." };
  }
  if (estInitialMikhmon(e.identifiant, e.motDePasse)) {
    return {
      erreur:
        "Le couple mikhmon / 1234 est interdit. " +
        "Changez le mot de passe dans Mikhmon puis saisissez le nouveau.",
    };
  }
  return construireUrlMikhmon(e.hote, e.port);
}

const COLONNES =
  "id, nom, variante_mikhmon, hote, port, url_mikhmon, role, " +
  "identifiant_mikhmon, statut_connexion, dernier_test_le, " +
  "mikhmon_change_requis, actif";

// Liste les installations de l'espace, jamais celles des autres.
export async function listerInstallations(
  ctx: ContexteTenant,
): Promise<InstallationMikhmon[]> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    "SELECT " + COLONNES + " FROM configurations_routeurs " +
      "WHERE tenant_id = $1 ORDER BY nom",
    [ctx.tenantId],
  );
  return (rows as Ligne[]).map(versInstallation);
}

// Lit une installation de l'espace (erreur si elle appartient a un autre).
export async function lireInstallation(
  ctx: ContexteTenant,
  id: number,
): Promise<InstallationMikhmon | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    "SELECT " + COLONNES + " FROM configurations_routeurs " +
      "WHERE id = $1 AND tenant_id = $2",
    [id, ctx.tenantId],
  );
  const lignes = rows as Ligne[];
  return lignes.length === 0 ? null : versInstallation(lignes[0]);
}

// Enregistre une installation (mot de passe chiffre, jamais en clair).
export async function creerInstallation(
  ctx: ContexteTenant,
  e: EntreeInstallation,
): Promise<{ installation: InstallationMikhmon } | { erreur: string }> {
  verifierContexte(ctx);
  const valide = validerEntree(e);
  if ("erreur" in valide) return valide;
  await assurerEspace(ctx);
  try {
    const { rows } = await db.query(
      `INSERT INTO configurations_routeurs
        (tenant_id, utilisateur_id, nom, variante_mikhmon, url_mikhmon,
         hote, port, role, identifiant_mikhmon, mot_de_passe_mikhmon_chiffre,
         adresse_routeros, utilisateur_lecture, utilisateur_correction,
         mot_de_passe_correction_chiffre, mikhmon_change_requis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'','','',$11,false)
       RETURNING ` + COLONNES,
      [
        ctx.tenantId,
        ctx.utilisateurId,
        e.nom.trim(),
        e.variante,
        valide.url,
        e.hote.trim(),
        e.port,
        e.role,
        e.identifiant.trim(),
        chiffrer(e.motDePasse),
        // Partie RouterOS vide a ce stade : la section « Mes routeurs »
        // la remplit ensuite (jamais de mot de passe provisoire).
        chiffrer(""),
      ],
    );
    return { installation: versInstallation((rows as Ligne[])[0]) };
  } catch (e) {
    if (estViolationUnicite(e)) {
      return { erreur: MESSAGE_CONNEXION_EXISTANTE };
    }
    throw e;
  }
}

// Modifie une installation (le mot de passe est toujours re-saisi,
// jamais pré-rempli ni réutilisé silencieusement).
export async function modifierInstallation(
  ctx: ContexteTenant,
  id: number,
  e: EntreeInstallation,
): Promise<{ installation: InstallationMikhmon } | { erreur: string }> {
  verifierContexte(ctx);
  if (!e.motDePasse) {
    return { erreur: "Mot de passe obligatoire pour modifier." };
  }
  const valide = validerEntree(e);
  if ("erreur" in valide) return valide;
  try {
    const { rows } = await db.query(
      `UPDATE configurations_routeurs
     SET nom=$3, variante_mikhmon=$4, url_mikhmon=$5, hote=$6, port=$7,
         role=$8, identifiant_mikhmon=$9,
         mot_de_passe_mikhmon_chiffre=$10, updated_at=now()
     WHERE id=$1 AND tenant_id=$2
     RETURNING ` + COLONNES,
      [
        id,
        ctx.tenantId,
        e.nom.trim(),
        e.variante,
        valide.url,
        e.hote.trim(),
        e.port,
        e.role,
        e.identifiant.trim(),
        chiffrer(e.motDePasse),
      ],
    );
    const lignes = rows as Ligne[];
    if (lignes.length === 0) return { erreur: "Installation introuvable." };
    return { installation: versInstallation(lignes[0]) };
  } catch (e) {
    if (estViolationUnicite(e)) {
      return { erreur: MESSAGE_CONNEXION_EXISTANTE };
    }
    throw e;
  }
}

// Desactive une installation (disabled=yes, jamais de suppression
// d'objet) : elle reste en base mais n'est plus proposee.
export async function desactiverInstallation(
  ctx: ContexteTenant,
  id: number,
): Promise<boolean> {
  verifierContexte(ctx);
  const { rowCount } = await db.query(
    "UPDATE configurations_routeurs SET actif=false, updated_at=now() " +
      "WHERE id=$1 AND tenant_id=$2",
    [id, ctx.tenantId],
  );
  return (rowCount ?? 0) > 0;
}

// Supprime une ligne de configuration locale, apres confirmation UI.
// Ne touche jamais au routeur : seul RouterOS cree/desactive ses objets.
export async function supprimerInstallation(
  ctx: ContexteTenant,
  id: number,
): Promise<boolean> {
  verifierContexte(ctx);
  const { rowCount } = await db.query(
    "DELETE FROM configurations_routeurs WHERE id=$1 AND tenant_id=$2",
    [id, ctx.tenantId],
  );
  return (rowCount ?? 0) > 0;
}

// Teste la connexion COTE SERVEUR (jamais depuis le navigateur) puis
// memorise le statut et la date du test. Ne journalise aucun secret.
export async function testerInstallation(
  ctx: ContexteTenant,
  id: number,
): Promise<{ enLigne: boolean } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    "SELECT url_mikhmon, hote, port FROM configurations_routeurs " +
      "WHERE id=$1 AND tenant_id=$2",
    [id, ctx.tenantId],
  );
  const lignes = rows as {
    url_mikhmon: string;
    hote: string | null;
    port: number;
  }[];
  if (lignes.length === 0) return { erreur: "Installation introuvable." };
  const calcule = lignes[0].hote
    ? construireUrlMikhmon(lignes[0].hote, lignes[0].port)
    : null;
  const url =
    calcule && "url" in calcule ? calcule.url : lignes[0].url_mikhmon;
  try {
    await testerMikhmon(url);
  } catch (e) {
    await db.query(
      "UPDATE configurations_routeurs SET statut_connexion='hors-ligne', " +
        "dernier_test_le=now(), updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2",
      [id, ctx.tenantId],
    );
    return { erreur: e instanceof Error ? e.message : "Test impossible." };
  }
  await db.query(
    "UPDATE configurations_routeurs SET statut_connexion='en-ligne', " +
      "dernier_test_le=now(), updated_at=now() " +
      "WHERE id=$1 AND tenant_id=$2",
    [id, ctx.tenantId],
  );
  return { enLigne: true };
}
