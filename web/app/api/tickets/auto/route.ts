import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { rosLecture, rosAvecIdentifiants } from "@/lib/routeros";
import { dechiffrer } from "@/lib/chiffrement";
import { genererLot, EchecDeclenchement } from "@/lib/tickets";
import { CANAUX_LIVRAISON } from "@/lib/runs-tickets";

// Ronde automatique : pour chaque abonnement ACTIF (activation explicite
// = validation humaine prealable), lit le stock reel et declenche n8n
// quand il passe sous le seuil. Protegee par CRON_SECRET. Anti-duplication :
// - un seul run actif par (tenant, routeur, profil) : un run en
//   demande/lance fait sauter le tour (pas de relance tant que le stock
//   reste sous le seuil et que le precedent n'est pas termine/echoue) ;
// - runId deterministe par tranche de 15 min : deux verifications
//   simultanees partagent le meme run (idempotence) ;
// - delai minimal via lots recents (30 min) ;
// - jamais de generation si le stock atteint deja la cible.
// Quantites et durees : entiers uniquement, jamais de flottant.
// A appeler toutes les 15 minutes (cron systeme ou Schedule n8n),
// jamais de setInterval dans Next.js.
const CRON = process.env.CRON_SECRET ?? "";

function autorise(req: Request) {
  if (!CRON) return false;
  const recu = Buffer.from(req.headers.get("x-cron-secret") ?? "");
  const attendu = Buffer.from(CRON);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

type UtilisateurHotspot = {
  profile?: unknown; disabled?: unknown; uptime?: unknown;
};

// Definition du stock "neuf" : meme profil, actif, jamais utilise.
// Ni les tickets deja utilises, ni les desactives, ni le total brut.
function estNeuf(u: UtilisateurHotspot, profil: string) {
  if (u.profile !== profil) return false;
  if (u.disabled === true
    || String(u.disabled ?? "").toLowerCase() === "true") return false;
  return ["0s", "00:00:00", ""].includes(String(u.uptime ?? "0s").trim());
}

type Abonnement = {
  tenant_id: unknown;
  utilisateur_id: unknown;
  profil: unknown;
  seuil: unknown;
  quantite_cible: unknown;
  canal: unknown;
  destinataire: unknown;
  telegram_chat_id: unknown;
  whatsapp_recipient: unknown;
  printnode_printer_id: unknown;
  configuration_routeur_id: unknown;
  adresse_routeros: unknown;
  utilisateur_correction: unknown;
  mot_de_passe_correction_chiffre: unknown;
  routeur_nom: unknown;
  routeur_parc_id: unknown;
  routeur_parc_url: unknown;
};

// Tranche de 15 minutes : deux rondes concurrentes partagent le runId.
function tranche15min(date: Date): string {
  const t = Math.floor(date.getTime() / 900000) * 900000;
  return new Date(t).toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export async function POST(req: Request) {
  if (!autorise(req)) {
    return Response.json({ error: "Non autorise." }, { status: 401 });
  }

  // Récupération : un run "lance" sans compte rendu depuis 30 minutes
  // est un crash n8n (pas un run lent : le compte rendu arrive en
  // minutes). On le marque echoue pour ne pas bloquer le triplet, en
  // gardant sa trace. Jamais de relance aveugle : la prochaine ronde
  // repart d'un runId neuf.
  try {
    await db.query(
      `UPDATE ticket_generation_runs SET statut = 'echoue',
         erreur = 'Compte rendu n8n jamais reçu (abandon après 30 min).',
         termine_le = now()
       WHERE statut = 'lance' AND created_at < now() - interval '30 minutes'`,
    );
  } catch (e) {
    console.error("[auto-reaper]", e);
  }

  let abos: Abonnement[];
  try {
    abos = (await db.query(
      `SELECT a.tenant_id, a.profil, a.seuil, a.quantite_cible, a.canal,
         a.destinataire, a.telegram_chat_id, a.whatsapp_recipient,
         a.printnode_printer_id, a.configuration_routeur_id,
         c.adresse_routeros, c.utilisateur_correction,
         c.mot_de_passe_correction_chiffre, c.nom AS routeur_nom,
         a.routeur_id AS routeur_parc_id, r.url_base AS routeur_parc_url,
         COALESCE(a.utilisateur_id, 'ronde') AS utilisateur_id
       FROM abonnements_tickets a
       LEFT JOIN configurations_routeurs c
         ON c.id = a.configuration_routeur_id
       LEFT JOIN routeurs r ON r.id = a.routeur_id
       WHERE a.actif = true`)).rows as Abonnement[];
  } catch (e) {
    console.error("[auto]", e);
    return Response.json({ error: "Echec de la ronde." }, { status: 500 });
  }

  const declenches: unknown[] = [];
  const ignores: unknown[] = [];
  const erreurs: unknown[] = [];

  for (const a of abos) {
    const tenantId = String(a.tenant_id ?? "defaut");
    const utilisateurId = String(a.utilisateur_id ?? "ronde");
    const profil = String(a.profil);
    const seuil = Number(a.seuil);
    const cible = Number(a.quantite_cible);
    const configId = a.configuration_routeur_id === null
      ? null
      : Number(a.configuration_routeur_id);
    const cleRouteur = configId === null
      ? "parc-" + String(a.routeur_parc_id)
      : "config-" + configId;
    try {
      // Canal : jamais de reecriture silencieuse, ignore motive sinon.
      const canalBrut = String(a.canal);
      if (!(CANAUX_LIVRAISON as readonly string[]).includes(canalBrut)) {
        ignores.push({ profil, stock: null, seuil,
          motif: "canal non pris en charge" });
        continue;
      }

      // Connexion : configuration chiffree du tenant, sinon parc historique
      // (identifiants dedies dans l'environnement).
      let baseUrl = "";
      let routerUser = process.env.N8N_ROUTER_USER ?? "n8n-vouchers";
      let routerPassword = process.env.N8N_ROUTER_PASS ?? "";
      let routeurNom = "";
      if (configId !== null) {
        if (!a.adresse_routeros) {
          ignores.push({ profil, stock: null, seuil,
            motif: "configuration routeur incomplète" });
          continue;
        }
        baseUrl = String(a.adresse_routeros);
        routerUser = String(a.utilisateur_correction);
        try {
          routerPassword = dechiffrer(
            String(a.mot_de_passe_correction_chiffre));
        } catch {
          ignores.push({ profil, stock: null, seuil,
            motif: "secret routeur illisible" });
          continue;
        }
        routeurNom = String(a.routeur_nom ?? "");
      } else {
        if (!a.routeur_parc_url) {
          ignores.push({ profil, stock: null, seuil,
            motif: "routeur du parc introuvable" });
          continue;
        }
        baseUrl = String(a.routeur_parc_url);
        routeurNom = "";
      }

      // Stock reel sur le routeur (lecture seule).
      const ros = configId !== null
        ? rosAvecIdentifiants(baseUrl, routerUser, routerPassword)
        : rosLecture(baseUrl);
      const brut = await ros.get("/ip/hotspot/user");
      const users = (Array.isArray(brut) ? brut : []) as UtilisateurHotspot[];
      const stock = users.filter((u) => estNeuf(u, profil)).length;

      // Marque la verification (tableau de bord de reappro).
      await db.query(
        `UPDATE abonnements_tickets
         SET derniere_verif_le=now(), dernier_stock=$1, derniere_erreur=NULL
         WHERE tenant_id=$2 AND profil=$3
           AND COALESCE(configuration_routeur_id,-1)
             = COALESCE($4,-1)`,
        [stock, tenantId, profil, configId]);

      if (stock > seuil) {
        ignores.push({ profil, stock, seuil, motif: "stock suffisant" });
        continue;
      }
      if (stock >= cible) {
        ignores.push({ profil, stock, seuil, cible,
          motif: "cible déjà atteinte" });
        continue;
      }

      // Verrou : un run actif (demande/lance) pour ce triplet fait
      // sauter le tour, quel que soit le stock.
      const { rows: actifs } = await db.query(
        `SELECT id FROM ticket_generation_runs
         WHERE tenant_id=$1 AND profil=$2
           AND COALESCE(router_connection_id,-1) = COALESCE($3,-1)
           AND statut IN ('demande','lance') LIMIT 1`,
        [tenantId, profil, configId]);
      if (actifs.length > 0) {
        ignores.push({ profil, stock, seuil,
          motif: "génération déjà en cours" });
        continue;
      }
      // Delai minimal : un lot recent non absorbe fait sauter le tour.
      const { rows: recents } = await db.query(
        `SELECT id FROM lots_tickets
         WHERE tenant_id = $1 AND profil = $2
           AND statut IN ('demande','lance')
           AND created_at > now() - interval '30 minutes' LIMIT 1`,
        [tenantId, profil]);
      if (recents.length > 0) {
        ignores.push({ profil, stock, seuil,
          motif: "lot recent en cours" });
        continue;
      }

      const quantite = Math.min(500, Math.max(1, cible));
      const runId = "auto-" + tenantId + "-" + cleRouteur + "-" +
        profil.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32) + "-" +
        tranche15min(new Date());
      const res = await genererLot({
        userId: utilisateurId,
        tenantId,
        mikhmonConnectionId: null,
        routerConnectionId: configId,
        profile: profil,
        threshold: seuil,
        targetQuantity: quantite,
        deliveryChannel:
          canalBrut as (typeof CANAUX_LIVRAISON)[number],
        telegramChatId: typeof a.telegram_chat_id === "string"
          ? a.telegram_chat_id : null,
        whatsappRecipient: typeof a.whatsapp_recipient === "string"
          ? a.whatsapp_recipient : null,
        printNodePrinterId: typeof a.printnode_printer_id === "string"
          ? a.printnode_printer_id : null,
        runId,
        routeurNom,
        routeurUrlBase: baseUrl,
        routerUser,
        routerPassword,
        jetonTelegram: "",
        secretWhatsApp: "",
        clePrintNode: "",
        stockAvant: stock,
      });
      if (res.run_existant) {
        ignores.push({ profil, stock, seuil,
          motif: "run déjà traité (double ronde)" });
        continue;
      }
      declenches.push({ lot_id: res.lot_id, profil, stock, seuil,
        cible, quantite, run_id: res.cle_idempotence });
    } catch (e) {
      if (e instanceof EchecDeclenchement) {
        await db.query(
          `UPDATE abonnements_tickets SET derniere_erreur=$1
           WHERE tenant_id=$2 AND profil=$3
             AND COALESCE(configuration_routeur_id,-1)
               = COALESCE($4,-1)`,
          [e.message.slice(0, 300), tenantId, profil, configId]);
        erreurs.push({ profil, erreur: e.message });
        continue;
      }
      console.error("[auto]", profil, e);
      erreurs.push({ profil,
        erreur: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({
    data: { controles: abos.length, declenches, ignores, erreurs },
  });
}
