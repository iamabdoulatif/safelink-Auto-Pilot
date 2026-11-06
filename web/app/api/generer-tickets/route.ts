import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import { lireInstallation } from "@/lib/mikhmon-installations";
import { deriverUrlMikhmonPourAppelant } from "@/lib/derivation-url";
import { lireBot } from "@/lib/bots-telegram";
import {
  lireRun,
  mettreAJourRun,
  reserverRun,
  validerEntreeRun,
} from "@/lib/runs-tickets";
import {
  EchecDeclenchement,
  genererLot,
} from "@/lib/tickets";
import { resoudreEnvois } from "@/lib/envois-supplementaires";
import { destinatairesZonePourRouteur, numerosVendeursZone } from "@/lib/zones-wifi";
import type { CanalLivraison } from "@/lib/tickets";

// Generation de tickets Hotspot, en deux temps (validation humaine) :
// SANS « confirme », recapitulatif SANS rien ecrire ni appeler (ni ligne,
// ni n8n). AVEC « confirme: true », le runId est reserve (rejouer le meme
// runId retrouve le run au lieu de recreer des tickets : idempotence),
// puis la generation part vers n8n, signee. Les mots de passe des tickets
// ne sont jamais stockes : seuls profil, quantites, canal et statuts
// restent en base. Les tickets sont crees sur RouterOS (/ip/hotspot/user)
// et sont visibles automatiquement dans Mikhmon.
const MESSAGE_SOURCE =
  "Les tickets sont créés sur RouterOS et sont visibles automatiquement " +
  "dans Mikhmon.";

type ConfigRouteurLot = {
  id: number;
  nom: string;
  variante_mikhmon: string;
  adresse_routeros: string;
  utilisateur_correction: string;
  mot_de_passe_correction_chiffre: string;
};

export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "gerant"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const quantiteBrute = b["quantity"];
  const quantite = typeof quantiteBrute === "number"
    ? quantiteBrute
    : Number(quantiteBrute);
  const mikhmonBrut = b["mikhmonConnectionId"];
  const routeurBrut = b["routerConnectionId"];
  const runBrut = typeof b["runId"] === "string" && b["runId"].trim()
    ? b["runId"].trim()
    : randomUUID();
  const entree = {
    mikhmonConnectionId: Number.isInteger(mikhmonBrut)
      ? (mikhmonBrut as number)
      : null,
    routerConnectionId: Number.isInteger(routeurBrut)
      ? (routeurBrut as number)
      : null,
    profile: typeof b["profile"] === "string" ? b["profile"] : "",
    quantity: quantite,
    deliveryChannel:
      typeof b["deliveryChannel"] === "string" ? b["deliveryChannel"] : "",
    telegramChatId:
      typeof b["telegramChatId"] === "string" ? b["telegramChatId"] : null,
    runId: runBrut,
  };
  const invalide = validerEntreeRun(entree);
  if (invalide) {
    return Response.json({ error: invalide }, { status: 400 });
  }
  if (entree.routerConnectionId === null) {
    return Response.json({ error: "Routeur (routerConnectionId) obligatoire." },
      { status: 400 });
  }

  try {
    // La connexion Mikhmon donne l'URL depuis la config (jamais en dur) :
    // une derivation pour le navigateur, une pour n8n sous Docker macOS.
    let nomMikhmon: string | null = null;
    let urlNavigateur: string | null = null;
    let urlN8nDocker: string | null = null;
    if (entree.mikhmonConnectionId !== null) {
      const installation = await lireInstallation(
        ctx, entree.mikhmonConnectionId);
      if (!installation) {
        return Response.json(
          { error: "Installation Mikhmon introuvable." }, { status: 404 });
      }
      nomMikhmon = installation.nom;
      if (installation.hote) {
        const nav = deriverUrlMikhmonPourAppelant(
          installation.hote, installation.port, "navigateur");
        const dock = deriverUrlMikhmonPourAppelant(
          installation.hote, installation.port, "n8n-docker-mac");
        if ("url" in nav) urlNavigateur = nav.url;
        if ("url" in dock) urlN8nDocker = dock.url;
      }
    }

    const { rows } = await db.query<ConfigRouteurLot>(
      `SELECT id, nom, variante_mikhmon, adresse_routeros, utilisateur_correction,
         mot_de_passe_correction_chiffre
       FROM configurations_routeurs
       WHERE id = $1 AND tenant_id = $2`,
      [entree.routerConnectionId, ctx.tenantId]);
    if (rows.length === 0) {
      return Response.json({ error: "Routeur inconnu." }, { status: 404 });
    }
    const routeur = rows[0];

    let chatId = (entree.telegramChatId ?? "").trim();
    if (entree.deliveryChannel === "telegram" && !chatId) {
      const bot = await lireBot(ctx);
      if (!bot) {
        return Response.json(
          { error: "Configurez d'abord Telegram (page Configuration Telegram)." },
          { status: 409 });
      }
      chatId = bot.chatId;
    }

    // Rejeu d'un run connu : lecture seule, jamais de doublon.
    const existant = await lireRun(ctx, entree.runId);
    if (b["confirme"] !== true) {
      return Response.json({
        data: {
          apercu: true,
          run_id: entree.runId,
          run_connu: existant !== null,
          statut_run: existant ? existant.statut : null,
          routeur: routeur.nom,
          installation_mikhmon: nomMikhmon,
          url_mikhmon_navigateur: urlNavigateur,
          url_mikhmon_n8n_docker: urlN8nDocker,
          profil: entree.profile.trim(),
          quantite: entree.quantity,
          canal: entree.deliveryChannel,
          destinataire: chatId || "—",
          message: MESSAGE_SOURCE,
          validation_requise:
            "Relisez ce récapitulatif, puis renvoyez la demande avec " +
            "« confirme: true » et le même runId.",
        },
      });
    }

    if (existant && existant.statut !== "demande") {
      return Response.json({
        data: { run: existant, deja_traite: true, message: MESSAGE_SOURCE },
      });
    }

    const reservation = await reserverRun(ctx, {
      ...entree,
      telegramChatId: chatId || null,
    });
    if ("erreur" in reservation) {
      return Response.json({ error: reservation.erreur }, { status: 400 });
    }
    if (!reservation.nouveau && reservation.run.statut !== "demande") {
      return Response.json({
        data: {
          run: reservation.run,
          deja_traite: true,
          message: MESSAGE_SOURCE,
        },
      });
    }
    await mettreAJourRun(ctx, reservation.run.runId, { statut: "lance" });

    let secretRouteur: string;
    try {
      secretRouteur = dechiffrer(routeur.mot_de_passe_correction_chiffre);
    } catch {
      await mettreAJourRun(ctx, reservation.run.runId,
        { statut: "echoue", erreur: "Secret du routeur illisible." });
      return Response.json(
        { error: "Secret du routeur illisible : reconfigurez-le." },
        { status: 500 });
    }
    if (!secretRouteur) {
      await mettreAJourRun(ctx, reservation.run.runId,
        { statut: "echoue", erreur: "Correction non configurée." });
      return Response.json(
        { error: "Mot de passe de correction manquant : renseignez-le." },
        { status: 409 });
    }

    // Jeton du bot personnalise (serveur uniquement, corps signe).
    let jetonTelegram = "";
    if (entree.deliveryChannel === "telegram") {
      const { rows: bots } = await db.query<{
        mode: string; jeton_chiffre: string | null;
      }>(
        `SELECT mode, jeton_chiffre FROM configurations_telegram
         WHERE tenant_id = $1`,
        [ctx.tenantId]);
      if (bots.length > 0 && bots[0].mode === "personnalise"
        && bots[0].jeton_chiffre) {
        try {
          jetonTelegram = dechiffrer(bots[0].jeton_chiffre);
        } catch {
          jetonTelegram = "";
        }
      }
    }

    // Copie WhatsApp systématique vers la zone du routeur (admin,
    // gérant, vendeurs), en plus du canal principal choisi.
    const destinatairesSupplementaires = await resoudreEnvois(
      ctx.tenantId,
      await destinatairesZonePourRouteur(ctx.tenantId, entree.routerConnectionId),
    );
    try {
      // runId = cle d'idempotence n8n : rejouer = retrouver, pas recreer.
      const lot = await genererLot({
        userId: ctx.utilisateurId,
        tenantId: ctx.tenantId,
        mikhmonConnectionId: entree.mikhmonConnectionId,
        routerConnectionId: entree.routerConnectionId,
        profile: entree.profile.trim(),
        threshold: 0,
        targetQuantity: entree.quantity,
        deliveryChannel: entree.deliveryChannel as CanalLivraison,
        telegramChatId:
          entree.deliveryChannel === "telegram" ? chatId || null : null,
        whatsappRecipient: null,
        printNodePrinterId: null,
        runId: reservation.run.runId,
        routeurNom: routeur.nom,
        routeurUrlBase: routeur.adresse_routeros,
        routerUser: routeur.utilisateur_correction,
        routerPassword: secretRouteur,
        jetonTelegram,
        destinatairesSupplementaires,
        vendeursZone: await numerosVendeursZone(ctx.tenantId, entree.routerConnectionId),
        varianteMikhmon: routeur.variante_mikhmon,
        forcerGeneration: true, // récapitulatif validé : saute le portillon
      });
      const run = await mettreAJourRun(ctx, reservation.run.runId,
        { statut: "lance" });
      return Response.json({
        data: {
          run_id: reservation.run.runId,
          lot_id: lot.lot_id,
          execution_id: lot.execution_id,
          statut: "lance",
          profil: entree.profile.trim(),
          quantite_demandee: entree.quantity,
          run,
          message: MESSAGE_SOURCE,
        },
      }, { status: 201 });
    } catch (e) {
      if (e instanceof EchecDeclenchement) {
        await mettreAJourRun(ctx, reservation.run.runId,
          { statut: "echoue", erreur: e.message });
        return Response.json({ error: e.message }, { status: e.http });
      }
      throw e;
    }
  } catch (e) {
    console.error("[generer-tickets]", e);
    return Response.json({ error: "Échec de la demande." }, { status: 500 });
  }
}
