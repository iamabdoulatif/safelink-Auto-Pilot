import { db } from "@/lib/db";
import { assurerEspace, type ContexteTenant } from "@/lib/acces-donnees";
import { hacherMotDePasse, verifierMotDePasse } from "@/lib/mot-de-passe";
import { signerSession } from "@/lib/session-cookie";

// Comptes utilisateurs : inscription (cree l'espace + le compte) et
// connexion (verifie le mot de passe). Le tenant derive du courriel
// normalise, jamais d'un en-tete. Les messages d'erreur ne revelent pas
// si un courriel existe (anti-enumeration).
export function normaliserCourriel(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const v = brut.trim().toLowerCase();
  if (v.length < 6 || v.length > 64) return null;
  if (!/^[a-z0-9._@-]+$/.test(v)) return null;
  const parties = v.split("@");
  if (parties.length !== 2 || !parties[0] || !parties[1].includes(".")) return null;
  return v;
}

export function validerMotDePasse(clair: unknown): string | null {
  if (typeof clair !== "string" || clair.length < 12) {
    return "12 caractères minimum.";
  }
  return null;
}

export type CompteCree = { tenantId: string; utilisateurId: string; numero?: string };

// Profil exigé à l'inscription : nom, prénom, pays et numéro, tous
// obligatoires. Le numéro garde son format international s'il est
// donné (+...), les espaces et tirets sont retirés.
export type ProfilInscription = {
  nom: string;
  prenom: string;
  pays: string;
  numero: string;
};

function texteObligatoire(brut: unknown, max: number): string | null {
  if (typeof brut !== "string") return null;
  const v = brut.trim().replace(/\s+/g, " ");
  return v.length >= 1 && v.length <= max ? v : null;
}

export function validerProfil(
  brut: Record<string, unknown>,
): ProfilInscription | { erreur: string } {
  const nom = texteObligatoire(brut["nom"], 60);
  if (!nom) return { erreur: "Nom obligatoire (60 caractères maximum)." };
  const prenom = texteObligatoire(brut["prenom"], 60);
  if (!prenom) return { erreur: "Prénom obligatoire (60 caractères maximum)." };
  const pays = texteObligatoire(brut["pays"], 60);
  if (!pays) return { erreur: "Pays obligatoire (60 caractères maximum)." };
  const numeroBrut = typeof brut["numero"] === "string" ? brut["numero"] : "";
  const numero = numeroBrut.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d{8,15}$/.test(numero)) {
    return { erreur: "Numéro obligatoire : 8 à 15 chiffres, indicatif international accepté (ex. +226 70 00 00 00)." };
  }
  return { nom, prenom, pays, numero };
}

// Inscrit un compte et son espace. Erreur "Courriel déjà utilisé." si pris.
export async function inscrireCompte(
  courrielBrut: unknown,
  motDePasseBrut: unknown,
  profilBrut: Record<string, unknown> = {},
): Promise<CompteCree | { erreur: string }> {
  const courriel = normaliserCourriel(courrielBrut);
  if (!courriel) return { erreur: "Courriel invalide." };
  const invalide = validerMotDePasse(motDePasseBrut);
  if (invalide) return { erreur: invalide };
  const profil = validerProfil(profilBrut);
  if ("erreur" in profil) return profil;
  const ctx: ContexteTenant = { tenantId: courriel, utilisateurId: courriel };
  await assurerEspace(ctx);
  const hash = hacherMotDePasse(motDePasseBrut as string);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO utilisateurs (tenant_id, courriel, hash_mot_de_passe, nom, prenom, pays, numero, numero_verifie)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false)
     ON CONFLICT (courriel) DO NOTHING
     RETURNING id`,
    [courriel, courriel, hash, profil.nom, profil.prenom, profil.pays, profil.numero],
  );
  if (rows.length === 0) return { erreur: "Courriel déjà utilisé." };
  // Le créateur est admin de son propre espace.
  await db.query(
    `INSERT INTO membres_espace (tenant_id, courriel, role)
     VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
    [courriel, courriel],
  );
  // Le numéro repart avec le compte : l'appelant en a besoin tout de
  // suite pour envoyer le code de validation WhatsApp.
  return { tenantId: courriel, utilisateurId: courriel, numero: profil.numero };
}

// Verifie un compte. Meme message que l'inscription en echec : on ne
// revele pas si le courriel existe.
export async function verifierConnexion(
  courrielBrut: unknown,
  motDePasseBrut: unknown,
): Promise<CompteCree | { erreur: string }> {
  const courriel = normaliserCourriel(courrielBrut);
  if (!courriel || typeof motDePasseBrut !== "string") {
    return { erreur: "Courriel ou mot de passe invalide." };
  }
  const { rows } = await db.query<{
    tenant_id: string; hash_mot_de_passe: string;
  }>(
    `SELECT tenant_id, hash_mot_de_passe FROM utilisateurs WHERE courriel = $1`,
    [courriel],
  );
  if (rows.length === 0) return { erreur: "Courriel ou mot de passe invalide." };
  if (!verifierMotDePasse(motDePasseBrut, rows[0].hash_mot_de_passe)) {
    return { erreur: "Courriel ou mot de passe invalide." };
  }
  return { tenantId: rows[0].tenant_id, utilisateurId: courriel };
}

// Valeur du cookie pour un compte verifie (signature HMAC serveur).
export function cookiePourCompte(secret: string, compte: CompteCree): string {
  return signerSession(secret, {
    utilisateurId: compte.utilisateurId,
    tenantId: compte.tenantId,
  });
}
