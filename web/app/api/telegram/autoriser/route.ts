import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement";
import { reserverRun } from "@/lib/runs-tickets";
import { rosAvecIdentifiants } from "@/lib/routeros";
import {
  profilExisteSurRouteur,
  validerDemandeAutorisation,
} from "@/lib/autorisation-telegram";

// Autorisation de generation depuis Telegram : retrouve l'utilisateur
// associe au chatId, verifie que bot et routeur lui appartiennent, que
// le profil existe REELLEMENT sur RouterOS (lecture seule) et qu'il est
// autorise a generer. Reserve le runId (anti-doublon) et renvoie les
// acces resolus cote serveur (jamais de mot de passe de ticket).
// Le tenantId envoye par le client n'est jamais lu. Refus motive sinon.
// TELEGRAM_ALLOWED_ID ne sert qu'en compatibilite admin global, traite
// dans le workflow.
function secretValide(recu: string): boolean {
  const attendu = process.env.N8N_WEBHOOK_SECRET ?? "";
  if (!attendu || !recu) return false;
  const a = createHash("sha256").update(attendu).digest();
  const b = createHash("sha256").update(Buffer.from(recu)).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

// Tranche de 15 minutes : deux demandes simultanees partagent le runId.
function tranche15min(date: Date): string {
  const t = Math.floor(date.getTime() / 900000) * 900000;
  return new Date(t).toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export async function POST(req: Request) {
  if (!(process.env.N8N_WEBHOOK_SECRET ?? "")) {
    return Response.json({ error: "Configuration n8n incomplète." },
      { status: 503 });
  }
  if (!secretValide(req.headers.get("x-n8n-secret") ?? "")) {
    return Response.json({ error: "Secret invalide." }, { status: 401 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const demande = validerDemandeAutorisation(corps);
  if ("erreur" in demande) {
    return Response.json({ error: demande.erreur }, { status: demande.statut });
  }
  const { chatId, routeurId, profil, qty, simulation } = demande;

  try {
    // 1) Utilisateur associe au chatId (tenant depuis la base, jamais du client).
    const { rows: bots } = await db.query(
      `SELECT tenant_id, utilisateur_id, mode, jeton_chiffre
       FROM configurations_telegram WHERE chat_id = $1`,
      [chatId]);
    const lignes = bots as {
      tenant_id: string; utilisateur_id: string; mode: string;
      jeton_chiffre: string | null;
    }[];
    if (lignes.length === 0) {
      return Response.json({
        data: { autorise: false,
          motif: "Aucun bot associé à cette discussion." },
      });
    }
    const compte = lignes[0];
    const ctx = {
      tenantId: compte.tenant_id,
      utilisateurId: compte.utilisateur_id,
    };

    // 2) Routeur choisi dans Telegram, verifie qu'il appartient au tenant.
    const { rows: routeurs } = await db.query(
      `SELECT id, nom, adresse_routeros, utilisateur_lecture,
         mot_de_passe_lecture_chiffre, utilisateur_correction,
         mot_de_passe_correction_chiffre
       FROM configurations_routeurs
       WHERE tenant_id = $1 AND id = $2 AND actif = true`,
      [ctx.tenantId, routeurId]);
    const configs = routeurs as {
      id: number; nom: string; adresse_routeros: string;
      utilisateur_lecture: string;
      mot_de_passe_lecture_chiffre: string | null;
      utilisateur_correction: string;
      mot_de_passe_correction_chiffre: string;
    }[];
    if (configs.length === 0) {
      return Response.json({
        data: { autorise: false, motif: "Routeur non autorisé ou inactif." },
      });
    }
    const routeur = configs[0];
    let motDePasse: string;
    let motDePasseLecture: string;
    try {
      motDePasse = dechiffrer(routeur.mot_de_passe_correction_chiffre);
      if (!routeur.mot_de_passe_lecture_chiffre) throw new Error("lecture absente");
      motDePasseLecture = dechiffrer(routeur.mot_de_passe_lecture_chiffre);
    } catch {
      return Response.json({
        data: { autorise: false,
          motif: "Compte RouterOS de lecture non configuré pour ce routeur." },
      });
    }

    // 3) Le profil existe-t-il VRAIMENT sur RouterOS ? Lecture seule
    // avec les identifiants chiffres du tenant. En echec : refuse ferme
    // (on ne genere jamais a l'aveugle).
    const ros = rosAvecIdentifiants(
      routeur.adresse_routeros,
      routeur.utilisateur_lecture,
      motDePasseLecture,
    );
    const existe = await profilExisteSurRouteur(
      () => ros.get("/ip/hotspot/user/profile"), profil);
    if (!existe) {
      return Response.json({
        data: { autorise: false,
          motif: "Profil introuvable sur le routeur." },
      });
    }

    // 4) Jeton du bot (personnalise dechiffre, central via l'env n8n).
    let jeton = "";
    if (compte.mode === "personnalise" && compte.jeton_chiffre) {
      try {
        jeton = dechiffrer(compte.jeton_chiffre);
      } catch {
        jeton = "";
      }
      if (!jeton) {
        return Response.json({
          data: { autorise: false, motif: "Jeton du bot illisible." },
        });
      }
    }

    // 5) RunId idempotent (suffixe -sim en simulation : jamais de
    // collision avec un vrai run, et aucune reservation).
    const runId = "tg-" + ctx.tenantId + "-" + profil + "-" + qty + "-" +
      tranche15min(new Date()) + (simulation ? "-sim" : "");
    if (!simulation) {
      const reservation = await reserverRun(ctx, {
        mikhmonConnectionId: null,
        routerConnectionId: routeur.id,
        profile: profil,
        quantity: qty,
        deliveryChannel: "telegram",
        telegramChatId: chatId,
        runId,
      });
      if ("erreur" in reservation) {
        return Response.json({
          data: { autorise: false,
            motif: "Un run identique est déjà en cours." },
        });
      }
    }

    // Limites Hotspot optionnelles (chaines RouterOS, ex. "3d") :
    // absentes = tickets sans limite. Jamais de secret ici.
    const limiteDuree = (process.env.LIMIT_UPTIME ?? "").trim() || null;
    const limiteVolume = (process.env.LIMIT_BYTES_TOTAL ?? "").trim() || null;

    return Response.json({
      data: {
        autorise: true,
        tenantId: ctx.tenantId,
        userId: ctx.utilisateurId,
        routerConnectionId: routeur.id,
        routeurNom: routeur.nom,
        routerBaseUrl: routeur.adresse_routeros,
        routerUser: routeur.utilisateur_correction,
        routerPassword: motDePasse,
        telegramMode: compte.mode,
        telegramBotToken: jeton,
        profile: profil,
        qty,
        runId,
        limitUptime: limiteDuree,
        limitBytesTotal: limiteVolume,
      },
    });
  } catch (e) {
    console.error("[telegram-autoriser]", e);
    return Response.json({ error: "Echec de la vérification." },
      { status: 500 });
  }
}
