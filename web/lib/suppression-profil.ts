import { db } from "@/lib/db";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { verifierContexte } from "@/lib/acces-donnees";
import {
  lireMotDePasseCorrection,
  lireMotDePasseLecture,
} from "@/lib/connexions-routeur";
import { rosAvecIdentifiants } from "@/lib/routeros";

// Suppression d'un profil Hotspot demandée depuis le dashboard.
// Procédure imposée (routeros-autofix) : sauvegarde, plan exact,
// filet de restauration, approbation humaine explicite, application
// un appel à la fois, vérification. Côté RouterOS on DÉSACTIVE
// (profil + tickets), on ne supprime jamais : c'est réversible.
// La règle SaaS et sa fiche profil sont supprimées après succès,
// et tout est journalisé dans suppressions_profils.

import {
  lignesDuPlan,
  nomSauvegarde,
  planSuppressionProfil,
} from "@/lib/suppression-profil-plan";
import type { ObjetRos, PlanSuppression } from "@/lib/suppression-profil-plan";
export type { ObjetRos, PlanSuppression } from "@/lib/suppression-profil-plan";

type ConfigRouteur = {
  nom: string;
  adresse: string;
  utilisateurLecture: string;
  utilisateurCorrection: string;
};

async function chargerRouteur(
  ctx: ContexteTenant,
  routerConnectionId: number,
): Promise<ConfigRouteur | null> {
  const { rows } = await db.query(
    `SELECT nom, adresse_routeros, utilisateur_lecture,
       utilisateur_correction
     FROM configurations_routeurs WHERE id = $1 AND tenant_id = $2`,
    [routerConnectionId, ctx.tenantId],
  );
  const lignes = rows as {
    nom: string; adresse_routeros: string;
    utilisateur_lecture: string; utilisateur_correction: string;
  }[];
  if (lignes.length === 0) return null;
  const l = lignes[0];
  return {
    nom: l.nom,
    adresse: l.adresse_routeros,
    utilisateurLecture: l.utilisateur_lecture,
    utilisateurCorrection: l.utilisateur_correction,
  };
}

export type ApercuSuppression = {
  regleId: number;
  profil: string;
  routeurNom: string;
  plan: PlanSuppression;
  sauvegarde: string;
  lignes: string[];
};

export async function apercuSuppression(
  ctx: ContexteTenant,
  regleId: number,
): Promise<{ apercu: ApercuSuppression } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows } = await db.query(
    `SELECT id, router_connection_id, profil
     FROM auto_replenishment_settings WHERE id = $1 AND tenant_id = $2`,
    [regleId, ctx.tenantId],
  );
  const regles = rows as {
    id: number; router_connection_id: number; profil: string;
  }[];
  if (regles.length === 0) return { erreur: "Règle introuvable." };
  const regle = regles[0];
  const routeur = await chargerRouteur(ctx, regle.router_connection_id);
  if (!routeur) return { erreur: "Routeur inconnu." };
  const motDePasse = await lireMotDePasseLecture(ctx, regle.router_connection_id);
  if (!motDePasse) {
    return { erreur: "Mot de passe de lecture RouterOS manquant." };
  }
  const ros = rosAvecIdentifiants(
    routeur.adresse, routeur.utilisateurLecture, motDePasse);
  let profils: ObjetRos[];
  let utilisateurs: ObjetRos[];
  try {
    profils = await ros.get<ObjetRos[]>("/ip/hotspot/user/profile");
    utilisateurs = await ros.get<ObjetRos[]>("/ip/hotspot/user");
  } catch {
    return { erreur: "Routeur injoignable en lecture : aperçu impossible." };
  }
  const plan = planSuppressionProfil(regle.profil, profils, utilisateurs);
  if (!plan.profilId) {
    return { erreur: `Profil « ${regle.profil} » introuvable sur le routeur.` };
  }
  const sauvegarde = nomSauvegarde(regle.profil);
  const filet = `safelink-filet-${Date.now()}`;
  return {
    apercu: {
      regleId: regle.id,
      profil: regle.profil,
      routeurNom: routeur.nom,
      plan,
      sauvegarde,
      lignes: lignesDuPlan(plan, sauvegarde, filet),
    },
  };
}

// Application après approbation explicite (nom du profil retapé).
// Arrêt immédiat au premier échec RouterOS, journal à chaque étape.
export async function appliquerSuppression(
  ctx: ContexteTenant,
  regleId: number,
): Promise<
  | { ok: true; profil: string; ticketsDesactives: number; sauvegarde: string }
  | { erreur: string }
> {
  verifierContexte(ctx);
  const apercuResultat = await apercuSuppression(ctx, regleId);
  if ("erreur" in apercuResultat) return apercuResultat;
  const { apercu } = apercuResultat;
  const { rows: regles } = await db.query(
    `SELECT router_connection_id FROM auto_replenishment_settings
     WHERE id = $1 AND tenant_id = $2`,
    [regleId, ctx.tenantId],
  );
  const routerConnectionId = (regles[0] as { router_connection_id: number })
    .router_connection_id;
  const routeur = await chargerRouteur(ctx, routerConnectionId);
  if (!routeur) return { erreur: "Routeur inconnu." };
  const motDePasse = await lireMotDePasseCorrection(ctx, routerConnectionId);
  if (!motDePasse) {
    return { erreur: "Mot de passe d'écriture RouterOS manquant." };
  }
  const ros = rosAvecIdentifiants(
    routeur.adresse, routeur.utilisateurCorrection, motDePasse);
  const sauvegarde = apercu.sauvegarde;
  const filet = `safelink-filet-${Date.now()}`;

  const { rows: journal } = await db.query(
    `INSERT INTO suppressions_profils
       (tenant_id, router_connection_id, profil, plan, sauvegarde_nom,
        approuve_par, statut)
     VALUES ($1,$2,$3,$4,$5,$6,'en-cours') RETURNING id`,
    [ctx.tenantId, routerConnectionId, apercu.profil,
      JSON.stringify(apercu.lignes), sauvegarde, ctx.utilisateurId],
  );
  const journalId = (journal[0] as { id: number }).id;
  const terminer = async (statut: string, resultat: string,
    tickets?: number) => {
    await db.query(
      `UPDATE suppressions_profils
       SET statut = $2, resultat = $3, tickets_desactives = $4,
           termine_le = now()
       WHERE id = $1`,
      [journalId, statut, resultat.slice(0, 500), tickets ?? null],
    );
  };

  try {
    // 1) Sauvegarde (commande RouterOS = POST, pas PUT), puis filet.
    await ros.appel("/system/backup/save", { name: sauvegarde });
    await ros.add("/system/scheduler", {
      name: filet, "start-time": "startup", interval: "5m",
      "on-event": `/system/backup/load name=${sauvegarde}`,
    });
    const filetsRelus = await ros.get<ObjetRos[]>("/system/scheduler");
    const filetId = String(
      filetsRelus.find((f) => String(f["name"] ?? "") === filet)?.[".id"] ?? "");

    // 2) Désactivation : un ticket à la fois. Le profil Hotspot
    // n'a pas d'état disabled dans RouterOS (inspect à l'appui) :
    // sans ticket actif, il est de fait inutilisable.
    let desactives = 0;
    for (const id of apercu.plan.idsTickets) {
      await ros.set(`/ip/hotspot/user/${id}`, { disabled: true });
      desactives++;
    }

    // 3) Vérification : aucun ticket du profil encore actif.
    const usersRelus = await ros.get<ObjetRos[]>("/ip/hotspot/user");
    const encoreActifs = usersRelus.filter(
      (u) => String(u["profile"] ?? "") === apercu.profil
        && u["disabled"] !== true && u["disabled"] !== "true").length;
    if (encoreActifs > 0) {
      await terminer("echec",
        `${encoreActifs} tickets encore actifs après désactivation.`,
        desactives);
      return {
        erreur: `Vérification échouée : ${encoreActifs} tickets encore actifs.`,
      };
    }
    await ros.get("/system/resource");

    // 4) Filet désarmé (jamais supprimé), règle SaaS supprimée.
    if (filetId) {
      await ros.set(`/system/scheduler/${filetId}`, { disabled: true });
    }
    await db.query(
      "DELETE FROM auto_replenishment_settings WHERE id = $1 AND tenant_id = $2",
      [regleId, ctx.tenantId],
    );
    await db.query(
      `DELETE FROM hotspot_profiles
       WHERE tenant_id = $1 AND router_connection_id = $2 AND nom = $3`,
      [ctx.tenantId, routerConnectionId, apercu.profil],
    );
    await terminer("termine",
      `Profil rendu inutilisable, ${desactives} tickets désactivés, sauvegarde ${sauvegarde}.`,
      desactives);
    return {
      ok: true, profil: apercu.profil,
      ticketsDesactives: desactives, sauvegarde,
    };
  } catch (e) {
    await terminer("echec",
      e instanceof Error ? e.message : "Échec RouterOS pendant la suppression.");
    return {
      erreur: "Échec pendant la désactivation : rien n'a été supprimé "
        + "côté SaaS. Détail : "
        + (e instanceof Error ? e.message : "erreur inconnue"),
    };
  }
}
