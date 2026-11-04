import { db } from "@/lib/db";
import { assurerEspace, verifierContexte } from "@/lib/acces-donnees";
import type { ContexteTenant } from "@/lib/acces-donnees";

// Suivi des generations de tickets (runs) et reglages par espace.
// Un runId = une ligne : rejouer le meme runId retrouve la ligne au lieu
// d'en creer une (idempotence, cle UNIQUE sur tenant_id + run_id).
// Entrees n8n attendues : userId/tenantId, mikhmonConnectionId,
// routerConnectionId, profile, quantity, deliveryChannel, telegramChatId,
// runId, timestamp. Les mots de passe des tickets ne sont JAMAIS stockes :
// seuls profil, quantites, canal et statuts sont conserves.

// Canal de livraison d'un lot (identique au workflow n8n).
export const CANAUX_LIVRAISON = [
  "interface",
  "telegram",
  "whatsapp",
  "printnode",
  "pdf",
] as const;
export type CanalLivraisonRun = (typeof CANAUX_LIVRAISON)[number];

// Statuts d'un run, de la demande a la cloture.
export type StatutRun =
  | "demande"
  | "lance"
  | "termine"
  | "echoue";

export type EntreeRun = {
  mikhmonConnectionId: number | null;
  routerConnectionId: number | null;
  profile: string;
  quantity: number; // entier strictement positif, jamais de flottant
  deliveryChannel: string;
  telegramChatId: string | null;
  runId: string;
};

export type RunTickets = {
  id: number;
  runId: string;
  mikhmonConnectionId: number | null;
  routerConnectionId: number | null;
  profil: string;
  quantiteDemandee: number;
  quantiteCreee: number;
  canalEnvoi: string;
  telegramChatId: string | null;
  statut: StatutRun;
  erreur: string | null;
  createdAt: string;
  termineLe: string | null;
};

export type ReglagesTickets = {
  profilDefaut: string | null;
  quantiteDefaut: number;
  canalDefaut: string;
  mikhmonConnectionId: number | null;
  routerConnectionId: number | null;
};

type LigneRun = {
  id: number;
  run_id: string;
  mikhmon_connection_id: number | null;
  router_connection_id: number | null;
  profil: string;
  quantite_demandee: number;
  quantite_creee: number;
  canal_envoi: string;
  telegram_chat_id: string | null;
  statut: string;
  erreur: string | null;
  created_at: string;
  termine_le: string | null;
};

function versRun(l: LigneRun): RunTickets {
  const statuts: readonly string[] = ["demande", "lance", "termine", "echoue"];
  return {
    id: l.id,
    runId: l.run_id,
    mikhmonConnectionId: l.mikhmon_connection_id,
    routerConnectionId: l.router_connection_id,
    profil: l.profil,
    quantiteDemandee: l.quantite_demandee,
    quantiteCreee: l.quantite_creee,
    canalEnvoi: l.canal_envoi,
    telegramChatId: l.telegram_chat_id,
    statut: (statuts.includes(l.statut) ? l.statut : "demande") as StatutRun,
    erreur: l.erreur,
    createdAt: l.created_at,
    termineLe: l.termine_le,
  };
}

// Valide une entree n8n, sans toucher au reseau.
export function validerEntreeRun(e: EntreeRun): string | null {
  if (!e.runId.trim() || e.runId.trim().length > 128) {
    return "runId obligatoire (1 à 128 caractères).";
  }
  if (!e.profile.trim() || e.profile.trim().length > 128) {
    return "Profil obligatoire (1 à 128 caractères).";
  }
  if (!Number.isInteger(e.quantity) || e.quantity < 1 || e.quantity > 500) {
    return "Quantité invalide (entier entre 1 et 500).";
  }
  if (!(CANAUX_LIVRAISON as readonly string[]).includes(e.deliveryChannel)) {
    return "Canal de livraison inconnu.";
  }
  if (
    e.deliveryChannel === "telegram" &&
    (!e.telegramChatId || !/^-?\d{1,20}$/.test(e.telegramChatId.trim()))
  ) {
    return "Chat ID Telegram obligatoire pour ce canal.";
  }
  return null;
}

const COLONNES_RUN =
  "id, run_id, mikhmon_connection_id, router_connection_id, profil, " +
  "quantite_demandee, quantite_creee, canal_envoi, telegram_chat_id, " +
  "statut, erreur, created_at, termine_le";

// Reserve un run : cree la ligne, ou retrouve l'existante si le runId a
// deja ete vu (idempotence). Ne cree jamais de doublon.
export async function reserverRun(
  ctx: ContexteTenant,
  e: EntreeRun,
): Promise<{ run: RunTickets; nouveau: boolean } | { erreur: string }> {
  verifierContexte(ctx);
  const invalide = validerEntreeRun(e);
  if (invalide) return { erreur: invalide };
  await assurerEspace(ctx);
  const { rows } = await db.query(
    `INSERT INTO ticket_generation_runs
       (run_id, tenant_id, utilisateur_id, mikhmon_connection_id,
        router_connection_id, profil, quantite_demandee, canal_envoi,
        telegram_chat_id, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'demande')
     ON CONFLICT (tenant_id, run_id) DO NOTHING
     RETURNING ` + COLONNES_RUN,
    [
      e.runId.trim(),
      ctx.tenantId,
      ctx.utilisateurId,
      e.mikhmonConnectionId,
      e.routerConnectionId,
      e.profile.trim(),
      e.quantity,
      e.deliveryChannel,
      e.telegramChatId?.trim() || null,
    ],
  );
  const lignes = rows as LigneRun[];
  if (lignes.length > 0) return { run: versRun(lignes[0]), nouveau: true };
  const existant = await lireRun(ctx, e.runId.trim());
  if (!existant) return { erreur: "Run introuvable après réservation." };
  return { run: existant, nouveau: false };
}

// Lit un run de l'espace (erreur silencieuse = null si autre espace).
export async function lireRun(
  ctx: ContexteTenant,
  runId: string,
): Promise<RunTickets | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    "SELECT " + COLONNES_RUN + " FROM ticket_generation_runs " +
      "WHERE run_id=$1 AND tenant_id=$2",
    [runId, ctx.tenantId],
  );
  const lignes = rows as LigneRun[];
  return lignes.length === 0 ? null : versRun(lignes[0]);
}

// Liste les runs recents de l'espace (historique des lots).
export async function listerRuns(
  ctx: ContexteTenant,
  limite: number,
): Promise<RunTickets[]> {
  verifierContexte(ctx);
  const n = Number.isInteger(limite) && limite > 0 && limite <= 200
    ? Math.floor(limite)
    : 50;
  const { rows } = await db.query(
    "SELECT " + COLONNES_RUN + " FROM ticket_generation_runs " +
      "WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT " + n,
    [ctx.tenantId],
  );
  return (rows as LigneRun[]).map(versRun);
}

// Met a jour un run (statut, quantite creee, erreur, cloture).
export async function mettreAJourRun(
  ctx: ContexteTenant,
  runId: string,
  patch: {
    statut: StatutRun;
    quantiteCreee?: number;
    erreur?: string | null;
  },
): Promise<RunTickets | null> {
  verifierContexte(ctx);
  const quantite =
    patch.quantiteCreee === undefined ? null : patch.quantiteCreee;
  if (quantite !== null && (!Number.isInteger(quantite) || quantite < 0)) {
    throw new Error("Quantité créée invalide (entier positif ou nul).");
  }
  const { rows } = await db.query(
    `UPDATE ticket_generation_runs
     SET statut=$3,
         quantite_creee=COALESCE($4, quantite_creee),
         erreur=COALESCE($5, erreur),
         termine_le=CASE WHEN $3 IN ('termine','echoue')
           THEN COALESCE(termine_le, now()) ELSE termine_le END
     WHERE run_id=$1 AND tenant_id=$2
     RETURNING ` + COLONNES_RUN,
    [
      runId,
      ctx.tenantId,
      patch.statut,
      quantite,
      patch.erreur === undefined ? null : patch.erreur,
    ],
  );
  const lignes = rows as LigneRun[];
  return lignes.length === 0 ? null : versRun(lignes[0]);
}

// Lit les reglages de l'espace (valeurs par defaut du formulaire).
export async function lireReglages(
  ctx: ContexteTenant,
): Promise<ReglagesTickets | null> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT profil_defaut, quantite_defaut, canal_defaut,
       mikhmon_connection_id, router_connection_id
     FROM ticket_generation_settings WHERE tenant_id=$1`,
    [ctx.tenantId],
  );
  const lignes = rows as {
    profil_defaut: string | null;
    quantite_defaut: number;
    canal_defaut: string;
    mikhmon_connection_id: number | null;
    router_connection_id: number | null;
  }[];
  if (lignes.length === 0) return null;
  return {
    profilDefaut: lignes[0].profil_defaut,
    quantiteDefaut: lignes[0].quantite_defaut,
    canalDefaut: lignes[0].canal_defaut,
    mikhmonConnectionId: lignes[0].mikhmon_connection_id,
    routerConnectionId: lignes[0].router_connection_id,
  };
}

// Enregistre les reglages de l'espace (un par tenant, ecrasement simple).
export async function enregistrerReglages(
  ctx: ContexteTenant,
  r: ReglagesTickets,
): Promise<{ reglages: ReglagesTickets } | { erreur: string }> {
  verifierContexte(ctx);
  if (
    !Number.isInteger(r.quantiteDefaut) || r.quantiteDefaut <= 0
  ) {
    return { erreur: "Quantité par défaut invalide (entier positif)." };
  }
  if (!(CANAUX_LIVRAISON as readonly string[]).includes(r.canalDefaut)) {
    return { erreur: "Canal par défaut inconnu." };
  }
  await assurerEspace(ctx);
  const { rows } = await db.query(
    `INSERT INTO ticket_generation_settings
       (tenant_id, utilisateur_id, profil_defaut, quantite_defaut,
        canal_defaut, mikhmon_connection_id, router_connection_id,
        updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (tenant_id) DO UPDATE
     SET utilisateur_id=$2, profil_defaut=$3, quantite_defaut=$4,
         canal_defaut=$5, mikhmon_connection_id=$6,
         router_connection_id=$7, updated_at=now()
     RETURNING profil_defaut, quantite_defaut, canal_defaut,
       mikhmon_connection_id, router_connection_id`,
    [
      ctx.tenantId,
      ctx.utilisateurId,
      r.profilDefaut?.trim() || null,
      r.quantiteDefaut,
      r.canalDefaut,
      r.mikhmonConnectionId,
      r.routerConnectionId,
    ],
  );
  const l = (rows as {
    profil_defaut: string | null;
    quantite_defaut: number;
    canal_defaut: string;
    mikhmon_connection_id: number | null;
    router_connection_id: number | null;
  }[])[0];
  return {
    reglages: {
      profilDefaut: l.profil_defaut,
      quantiteDefaut: l.quantite_defaut,
      canalDefaut: l.canal_defaut,
      mikhmonConnectionId: l.mikhmon_connection_id,
      routerConnectionId: l.router_connection_id,
    },
  };
}
