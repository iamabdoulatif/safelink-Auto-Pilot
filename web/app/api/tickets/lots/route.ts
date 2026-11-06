import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { dechiffrer } from "@/lib/chiffrement";
import {
  genererLot,
  EchecDeclenchement,
  parseVolumeOctets,
  dureeLimiteValide,
  prefixeValide,
  CANAUX_LIVRAISON,
} from "@/lib/tickets";
import type { CanalLivraison } from "@/lib/tickets";
import { lireSecretWhatsApp } from "@/lib/whatsapp";
import { lireClePrintNode } from "@/lib/printnode";

// Demande de tickets : SANS « confirme », renvoie un recapitulatif SANS
// rien ecrire (ni lot, ni run, ni appel n8n). AVEC « confirme: true »,
// la validation humaine est acquise et la generation part vers n8n :
// charge signee (HMAC), runId idempotent, 12 champs de contrat.
// Les mots de passe des tickets ne sont jamais stockes.
// « Les tickets sont créés dans RouterOS et deviennent visibles dans
// Mikhmon. »
type ConfigRouteur = {
  id: number;
  nom: string;
  adresse_routeros: string;
  utilisateur_correction: string;
  mot_de_passe_correction_chiffre: string;
};

type ConfigTelegram = {
  mode: string;
  chat_id: string;
  jeton_chiffre: string | null;
};

type ConfigCanale = {
  actif: boolean;
  statut_connexion: string;
};

export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "contributeur"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const ctx = { tenantId, utilisateurId };
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const routeurId = b["routeur_id"];
  const mikhmonId = b["mikhmon_connection_id"] ?? null;
  const profil = typeof b["profil"] === "string" ? b["profil"].trim() : "";
  const quantite = b["quantite"];
  const duree = typeof b["duree"] === "string" ? b["duree"].trim() : "";
  const volumeBrut = typeof b["volume"] === "string" ? b["volume"].trim() : "";
  const prefixe = typeof b["prefixe"] === "string" ? b["prefixe"].trim() : "";
  const canal = typeof b["canal"] === "string" ? b["canal"] : "interface";
  const confirme = b["confirme"] === true;

  if (!Number.isInteger(routeurId)) {
    return Response.json({ error: "routeur_id doit être un entier." },
      { status: 400 });
  }
  if (mikhmonId !== null && !Number.isInteger(mikhmonId)) {
    return Response.json(
      { error: "mikhmon_connection_id doit être un entier ou absent." },
      { status: 400 });
  }
  if (!profil || profil.length > 64) {
    return Response.json({ error: "Profil obligatoire (1 à 64 caractères)." },
      { status: 400 });
  }
  if (!Number.isInteger(quantite) || (quantite as number) < 1
    || (quantite as number) > 500) {
    return Response.json(
      { error: "Quantité : entier entre 1 et 500." }, { status: 400 });
  }
  if (duree && !dureeLimiteValide(duree)) {
    return Response.json(
      { error: "Durée invalide (ex. « 2h », « 30m », « 1d 2h »)." },
      { status: 400 });
  }
  let volumeOctets: number | undefined;
  if (volumeBrut) {
    const v = parseVolumeOctets(volumeBrut);
    if (v === null) {
      return Response.json(
        { error: "Volume invalide (ex. « 500Mo », « 2Go »)." },
        { status: 400 });
    }
    volumeOctets = v;
  }
  if (prefixe && !prefixeValide(prefixe)) {
    return Response.json(
      { error: "Préfixe invalide (lettres, chiffres, tiret, 12 max)." },
      { status: 400 });
  }
  if (!(CANAUX_LIVRAISON as readonly string[]).includes(canal)) {
    return Response.json(
      { error: "Canal inconnu : interface, telegram, whatsapp, printnode ou pdf." },
      { status: 400 });
  }

  try {
    const { rows: routeurs } = await db.query<ConfigRouteur>(
      `SELECT id, nom, adresse_routeros, utilisateur_correction,
         mot_de_passe_correction_chiffre
       FROM configurations_routeurs
       WHERE id = $1 AND tenant_id = $2`,
      [routeurId, tenantId]);
    if (routeurs.length === 0) {
      return Response.json({ error: "Routeur inconnu." }, { status: 404 });
    }
    const routeur = routeurs[0];
    let mikhmonNom: string | null = null;
    if (mikhmonId !== null) {
      const { rows: mikh } = await db.query<{ nom: string }>(
        "SELECT nom FROM configurations_routeurs WHERE id=$1 AND tenant_id=$2",
        [mikhmonId, tenantId]);
      if (mikh.length === 0) {
        return Response.json({ error: "Connexion Mikhmon inconnue." },
          { status: 404 });
      }
      mikhmonNom = mikh[0].nom;
    }
    const { rows: telegrams } = await db.query<ConfigTelegram>(
      `SELECT mode, chat_id, jeton_chiffre
       FROM configurations_telegram WHERE tenant_id = $1`,
      [tenantId]);
    const telegram = telegrams[0] ?? null;
    if (canal === "telegram" && !telegram) {
      return Response.json(
        { error: "Configurez d'abord Telegram (page Configuration Telegram)." },
        { status: 409 });
    }
    let destinataire = canal === "telegram" ? (telegram?.chat_id ?? "") : "";
    let secretWhatsApp = "";
    let clePrintNode = "";
    let imprimanteId: string | null = null;
    if (canal === "whatsapp") {
      const { rows } = await db.query<ConfigCanale & { destinataire_defaut: string }>(
        `SELECT actif, statut_connexion, destinataire_defaut
         FROM configurations_whatsapp WHERE tenant_id=$1`,
        [tenantId]);
      if (rows.length === 0 || !rows[0].actif) {
        return Response.json(
          { error: "WhatsApp non configuré ou désactivé." }, { status: 409 });
      }
      if (rows[0].statut_connexion !== "en-ligne") {
        return Response.json(
          { error: "WhatsApp non testé : validez la configuration d'abord." },
          { status: 409 });
      }
      destinataire = rows[0].destinataire_defaut;
      secretWhatsApp = (await lireSecretWhatsApp(ctx)) ?? "";
    }
    if (canal === "printnode") {
      const { rows } = await db.query<ConfigCanale & { printer_id: number | null }>(
        `SELECT actif, statut_connexion, printer_id
         FROM configurations_printnode WHERE tenant_id=$1`,
        [tenantId]);
      if (rows.length === 0 || !rows[0].actif) {
        return Response.json(
          { error: "PrintNode non configuré ou désactivé." },
          { status: 409 });
      }
      if (rows[0].statut_connexion !== "en-ligne" || !rows[0].printer_id) {
        return Response.json(
          { error: "PrintNode non testé : validez la configuration d'abord (jamais d'impression automatique sinon)." },
          { status: 409 });
      }
      destinataire = "imprimante " + rows[0].printer_id;
      imprimanteId = String(rows[0].printer_id);
      clePrintNode = (await lireClePrintNode(ctx)) ?? "";
      if (!clePrintNode) {
        return Response.json(
          { error: "Clé PrintNode illisible : reconfigurez-la." },
          { status: 500 });
      }
    }

    // Etape 1 : recapitulatif, AUCUNE ecriture, AUCUN appel reseau.
    if (!confirme) {
      return Response.json({
        data: {
          apercu: true,
          routeur: routeur.nom,
          connexion_mikhmon: mikhmonNom,
          profil,
          quantite,
          duree: duree || "illimitée",
          volume: volumeBrut || "illimité",
          prefixe: prefixe || "—",
          canal,
          destinataire: destinataire || "—",
          note: "Les tickets sont créés dans RouterOS et deviennent visibles dans Mikhmon.",
          validation_requise:
            "Relisez ce récapitulatif, puis renvoyez la demande avec « confirme: true ».",
        },
      });
    }

    // Etape 2 : validation humaine acquise, generation signee et idempotente.
    let motDePasseRouteur: string;
    try {
      motDePasseRouteur = dechiffrer(
        routeur.mot_de_passe_correction_chiffre);
    } catch {
      return Response.json(
        { error: "Secret du routeur illisible : reconfigurez-le." },
        { status: 500 });
    }
    let jetonTelegram = "";
    if (telegram && telegram.mode === "personnalise"
      && telegram.jeton_chiffre) {
      try {
        jetonTelegram = dechiffrer(telegram.jeton_chiffre);
      } catch {
        return Response.json(
          { error: "Jeton Telegram illisible : reconfigurez-le." },
          { status: 500 });
      }
    }
    const res = await genererLot({
      userId: utilisateurId,
      tenantId,
      mikhmonConnectionId:
        mikhmonId === null ? null : (mikhmonId as number),
      routerConnectionId: routeur.id,
      profile: profil,
      threshold: 0,
      targetQuantity: quantite as number,
      deliveryChannel: canal as CanalLivraison,
      telegramChatId: canal === "telegram" ? destinataire || null : null,
      whatsappRecipient: canal === "whatsapp" ? destinataire || null : null,
      printNodePrinterId: imprimanteId,
      runId: randomUUID(),
      routeurNom: routeur.nom,
      routeurUrlBase: routeur.adresse_routeros,
      routerUser: routeur.utilisateur_correction,
      routerPassword: motDePasseRouteur,
      dureeLimite: duree || undefined,
      volumeLimiteOctets: volumeOctets,
      prefixe: prefixe || undefined,
      jetonTelegram,
      secretWhatsApp,
      clePrintNode,
      forcerGeneration: true, // récapitulatif validé : saute le portillon
    });
    if (res.run_existant) {
      return Response.json({
        data: {
          lot_id: res.lot_id,
          cle_idempotence: res.cle_idempotence,
          statut: "existant",
          note: "Ce run a déjà été traité : rien n'a été relancé.",
        },
      });
    }
    return Response.json({
      data: {
        lot_id: res.lot_id,
        execution_id: res.execution_id,
        cle_idempotence: res.cle_idempotence,
        statut: "lance",
        profil,
        quantite_demandee: quantite,
      },
    });
  } catch (e) {
    if (e instanceof EchecDeclenchement) {
      return Response.json({ error: e.message }, { status: e.http });
    }
    console.error("[lots]", e);
    return Response.json({ error: "Échec de la demande." }, { status: 500 });
  }
}
