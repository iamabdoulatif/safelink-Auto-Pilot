import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { validerDestinataires } from "@/lib/destinataires-supplementaires";
import type { DestinataireSupplementaire } from "@/lib/destinataires-supplementaires";
import { verifierDestinataires } from "@/lib/envois-supplementaires";
import {
  listerProfilsHotspot,
  lireMotDePasseLecture,
} from "@/lib/connexions-routeur";

// Reglages de reapprovisionnement de l'espace connecte : source de
// configuration par utilisateur lue par n8n. Isolation stricte : chaque
// requete filtre sur tenant_id, jamais de donnees d'un autre espace.
// Reponses { data } ou { error } uniquement. Aucun secret n'est renvoye.
const CANAUX = ["telegram", "whatsapp", "printnode", "telechargement"] as const;

type LigneRegle = {
  id: number;
  tenant_id: string;
  utilisateur_id: string;
  router_connection_id: number;
  mikhmon_connection_id: number | null;
  profile_id: number | null;
  routeur_nom: string;
  profil: string;
  seuil: number;
  quantite_generation: number;
  quantite_cible: number;
  frequence_minutes: number;
  canal: string;
  destinataire: string;
  destinataires_supplementaires: DestinataireSupplementaire[];
  duree_limite: string | null;
  volume_limite_octets: number | null;
  actif: boolean;
  simulation_reussie: boolean;
  stock_rearme: boolean;
  dernier_stock: number | null;
  derniere_verif_le: string | null;
  derniere_erreur: string | null;
};

function entier(v: unknown, defaut: number, min: number, max: number): number {
  if (v === undefined || v === null || v === "") return defaut;
  if (!Number.isInteger(v)) return NaN;
  const n = v as number;
  return n >= min && n <= max ? n : NaN;
}

// Motifs qui empechent l'activation automatique d'une regle.
async function blocagesActivation(regleId: number, tenantId: string,
): Promise<string[]> {
  const motifs: string[] = [];
  const { rows } = await db.query(
    `SELECT s.router_connection_id, s.profile_id, s.canal,
       r.actif AS routeur_actif, r.statut_connexion AS routeur_statut,
       p.valide AS profil_valide, s.simulation_reussie, s.derniere_erreur
     FROM auto_replenishment_settings s
     JOIN configurations_routeurs r ON r.id = s.router_connection_id
     LEFT JOIN hotspot_profiles p ON p.id = s.profile_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [regleId, tenantId],
  );
  const lignes = rows as {
    router_connection_id: number; profile_id: number | null; canal: string;
    routeur_actif: boolean; routeur_statut: string;
    profil_valide: boolean | null; simulation_reussie: boolean;
    derniere_erreur: string | null;
  }[];
  if (lignes.length === 0) return ["Règle introuvable."];
  const l = lignes[0];
  if (!l.routeur_actif || l.routeur_statut !== "en-ligne") {
    motifs.push("Routeur non testé (statut « en-ligne » requis).");
  }
  if (l.profile_id === null || l.profil_valide !== true) {
    motifs.push("Profil Hotspot non validé.");
  }
  if (l.canal === "telegram") {
    const { rows: bots } = await db.query(
      `SELECT bot_verifie FROM configurations_telegram WHERE tenant_id = $1`,
      [tenantId],
    );
    const botsLignes = bots as { bot_verifie: boolean }[];
    if (botsLignes.length === 0 || !botsLignes[0].bot_verifie) {
      motifs.push("Bot Telegram non vérifié (getMe + Chat ID).");
    }
  }
  if (l.canal === "whatsapp") {
    const { rows: canaux } = await db.query(
      `SELECT statut_connexion FROM configurations_whatsapp
       WHERE tenant_id = $1`,
      [tenantId],
    );
    const canauxLignes = canaux as { statut_connexion: string }[];
    if (canauxLignes.length === 0 ||
      canauxLignes[0].statut_connexion !== "en-ligne") {
      motifs.push("Canal WhatsApp non testé.");
    }
  }
  if (l.canal === "printnode") {
    const { rows: imprimantes } = await db.query(
      `SELECT statut_connexion FROM configurations_printnode
       WHERE tenant_id = $1`,
      [tenantId],
    );
    const imprimantesLignes = imprimantes as { statut_connexion: string }[];
    if (imprimantesLignes.length === 0 ||
      imprimantesLignes[0].statut_connexion !== "en-ligne") {
      motifs.push("Imprimante PrintNode non configurée et testée.");
    }
  }
  if (!l.simulation_reussie) {
    motifs.push(l.derniere_erreur
      ? "Dernière simulation échouée : " + l.derniere_erreur +
        " Nouvel essai au prochain contrôle (15 minutes maximum)."
      : "Simulation en attente : elle se lance automatiquement au prochain " +
        "contrôle (15 minutes maximum).");
  }
  return motifs;
}

export async function GET() {
  const ctx = await session();
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.tenant_id, s.utilisateur_id, s.router_connection_id,
         s.mikhmon_connection_id, s.profile_id, r.nom AS routeur_nom,
         s.profil, s.seuil, s.quantite_generation, s.quantite_cible,
         s.frequence_minutes, s.canal, s.destinataire,
         s.destinataires_supplementaires, s.duree_limite,
         s.volume_limite_octets, s.actif, s.simulation_reussie,
         s.stock_rearme, s.dernier_stock, s.derniere_verif_le,
         s.derniere_erreur
       FROM auto_replenishment_settings s
       JOIN configurations_routeurs r ON r.id = s.router_connection_id
       WHERE s.tenant_id = $1 ORDER BY s.id`,
      [ctx.tenantId],
    );
    const regles = rows as LigneRegle[];
    const enrichies = [];
    for (const regle of regles) {
      enrichies.push({
        ...regle,
        blocages: regle.actif ? [] : await blocagesActivation(regle.id,
          ctx.tenantId),
      });
    }
    return Response.json({ data: { regles: enrichies } });
  } catch (e) {
    console.error("[reapprovisionnement]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await session();
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const routerConnectionId = b["routerConnectionId"];
  const profil = typeof b["profil"] === "string" ? b["profil"].trim() : "";
  const seuil = entier(b["seuil"], 50, 0, 10000);
  const quantiteGeneration = entier(b["quantiteGeneration"], 120, 1, 500);
  const quantiteCible = entier(b["quantiteCible"], 120, 1, 500);
  const frequence = entier(b["frequenceMinutes"], 15, 1, 1440);
  const canal = typeof b["canal"] === "string" ? b["canal"] : "telechargement";
  const destinataire = typeof b["destinataire"] === "string"
    ? b["destinataire"].trim() : "";
  const dureeLimite = typeof b["dureeLimite"] === "string" &&
    b["dureeLimite"].trim() ? b["dureeLimite"].trim() : null;
  const volumeBrut = b["volumeLimiteOctets"];
  const volume = volumeBrut === undefined || volumeBrut === null ||
    volumeBrut === "" ? null : volumeBrut;

  if (!Number.isInteger(routerConnectionId) ||
    (routerConnectionId as number) <= 0) {
    return Response.json({ error: "routerConnectionId doit être un entier." },
      { status: 400 });
  }
  if (!profil || profil.length > 64) {
    return Response.json({ error: "profil obligatoire (1 à 64 caractères)." },
      { status: 400 });
  }
  for (const [nom, v] of [["seuil", seuil],
    ["quantiteGeneration", quantiteGeneration],
    ["quantiteCible", quantiteCible],
    ["frequenceMinutes", frequence]] as const) {
    if (!Number.isInteger(v)) {
      return Response.json({ error: nom + " hors limites." }, { status: 400 });
    }
  }
  if (!(CANAUX as readonly string[]).includes(canal)) {
    return Response.json({ error: "canal inconnu." }, { status: 400 });
  }
  if ((canal === "telegram" || canal === "whatsapp") && !destinataire) {
    return Response.json({ error: "destinataire obligatoire pour ce canal." },
      { status: 400 });
  }
  if (destinataire.length > 128) {
    return Response.json({ error: "destinataire trop long (128 maximum)." },
      { status: 400 });
  }
  const autres = validerDestinataires(b["destinatairesSupplementaires"]);
  if ("erreur" in autres) {
    return Response.json({ error: autres.erreur }, { status: 400 });
  }
  if (volume !== null &&
    (!Number.isInteger(volume) || (volume as number) <= 0)) {
    return Response.json({ error: "volumeLimiteOctets doit être un entier." },
      { status: 400 });
  }
  const mikhmonBrut = b["mikhmonConnectionId"];
  const mikhmonId = Number.isInteger(mikhmonBrut) ? mikhmonBrut as number
    : null;
  const profilBrut = b["profileId"];
  const profilId = Number.isInteger(profilBrut) ? profilBrut as number : null;
  const routeurId = routerConnectionId as number;

  try {
    const refusAutres = await verifierDestinataires(ctx.tenantId, autres.liste);
    if (refusAutres) {
      return Response.json({ error: refusAutres }, { status: 400 });
    }
    const { rows: routeurs } = await db.query(
      `SELECT id FROM configurations_routeurs
       WHERE id = $1 AND tenant_id = $2`,
      [routerConnectionId, ctx.tenantId],
    );
    if (routeurs.length === 0) {
      return Response.json({ error: "Routeur inconnu." }, { status: 404 });
    }
    if (mikhmonId !== null) {
      const { rows: mikhmon } = await db.query(
        `SELECT id FROM configurations_routeurs
         WHERE id = $1 AND tenant_id = $2`,
        [mikhmonId, ctx.tenantId],
      );
      if (mikhmon.length === 0) {
        return Response.json({ error: "Connexion Mikhmon inconnue." },
          { status: 404 });
      }
    }
    let profilIdEnregistre: number | string | null = profilId;
    if (profilId !== null) {
      const { rows: profils } = await db.query(
        `SELECT id FROM hotspot_profiles
         WHERE id = $1 AND tenant_id = $2 AND router_connection_id = $3`,
        [profilId, ctx.tenantId, routerConnectionId],
      );
      if (profils.length === 0) {
        return Response.json({ error: "Profil inconnu pour ce routeur." },
          { status: 404 });
      }
    } else {
      const motDePasseLecture = await lireMotDePasseLecture(
        { tenantId: ctx.tenantId, utilisateurId: ctx.utilisateurId },
        routeurId,
      );
      if (!motDePasseLecture) {
        return Response.json({
          error: "Mot de passe de lecture RouterOS manquant pour valider le profil.",
        }, { status: 409 });
      }
      const resultatProfils = await listerProfilsHotspot(
        { tenantId: ctx.tenantId, utilisateurId: ctx.utilisateurId },
        routeurId,
        motDePasseLecture,
      );
      if ("erreur" in resultatProfils) {
        return Response.json({ error: resultatProfils.erreur }, { status: 502 });
      }
      if (!resultatProfils.profils.some((p) => p.nom === profil)) {
        return Response.json({
          error: "Profil Hotspot introuvable sur RouterOS.",
        }, { status: 400 });
      }
      const { rows: profils } = await db.query(
        `INSERT INTO hotspot_profiles
           (tenant_id, utilisateur_id, router_connection_id, nom, valide, actif,
            updated_at)
         VALUES ($1,$2,$3,$4,true,true,now())
         ON CONFLICT (tenant_id, router_connection_id, nom) DO UPDATE
         SET valide = true, actif = true, updated_at = now()
         RETURNING id`,
        [ctx.tenantId, ctx.utilisateurId, routerConnectionId, profil],
      );
      profilIdEnregistre = (profils[0] as { id: string | number }).id;
    }
    const { rows } = await db.query(
      `INSERT INTO auto_replenishment_settings
         (tenant_id, utilisateur_id, router_connection_id,
          mikhmon_connection_id, profile_id, profil, seuil,
          quantite_generation, quantite_cible, frequence_minutes, canal,
          destinataire, duree_limite, volume_limite_octets,
          destinataires_supplementaires)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (tenant_id, router_connection_id, profil) DO UPDATE SET
         mikhmon_connection_id = EXCLUDED.mikhmon_connection_id,
         profile_id = EXCLUDED.profile_id, seuil = EXCLUDED.seuil,
         quantite_generation = EXCLUDED.quantite_generation,
         quantite_cible = EXCLUDED.quantite_cible,
         frequence_minutes = EXCLUDED.frequence_minutes,
         canal = EXCLUDED.canal, destinataire = EXCLUDED.destinataire,
         duree_limite = EXCLUDED.duree_limite,
         volume_limite_octets = EXCLUDED.volume_limite_octets,
         destinataires_supplementaires = EXCLUDED.destinataires_supplementaires,
         updated_at = now()
       RETURNING id`,
      [ctx.tenantId, ctx.utilisateurId, routerConnectionId, mikhmonId,
      profilIdEnregistre, profil, seuil, quantiteGeneration, quantiteCible,
        frequence, canal, destinataire, dureeLimite, volume,
        JSON.stringify(autres.liste)],
    );
    const regleId = (rows[0] as { id: number }).id;
    return Response.json({
      data: {
        id: regleId,
        blocages: await blocagesActivation(regleId, ctx.tenantId),
      },
    }, { status: 201 });
  } catch (e) {
    console.error("[reapprovisionnement]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}

// Activation confirmee par l'utilisateur, verifications serveur requises.
// Tant que l'utilisateur n'a pas active, aucune generation n'est possible.
export async function PATCH(req: Request) {
  const ctx = await session();
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const regleBrut = b["regleId"];
  const regleId = typeof regleBrut === "number"
    ? regleBrut
    : typeof regleBrut === "string" && /^\d+$/.test(regleBrut.trim())
      ? Number(regleBrut)
      : NaN;
  if (!Number.isSafeInteger(regleId) || regleId <= 0) {
    return Response.json({ error: "regleId doit être un entier." },
      { status: 400 });
  }
  const actif = b["actif"] === true;
  try {
    const { rows } = await db.query(
      `SELECT id FROM auto_replenishment_settings
       WHERE id = $1 AND tenant_id = $2`,
      [regleId, ctx.tenantId],
    );
    if (rows.length === 0) {
      return Response.json({ error: "Règle introuvable." }, { status: 404 });
    }
    if (actif) {
      const blocages = await blocagesActivation(regleId, ctx.tenantId);
      if (blocages.length > 0) {
        return Response.json(
          { error: "Activation impossible : " + blocages.join(" ") },
          { status: 428 },
        );
      }
    }
    await db.query(
      `UPDATE auto_replenishment_settings
       SET actif = $2, stock_rearme = true, updated_at = now()
       WHERE id = $1`,
      [regleId, actif],
    );
    return Response.json({ data: { id: regleId, actif } });
  } catch (e) {
    console.error("[reapprovisionnement]", e);
    return Response.json({ error: "Mise à jour impossible." },
      { status: 500 });
  }
}
