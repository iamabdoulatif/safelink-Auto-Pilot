import type { DestinataireSupplementaire } from "@/lib/destinataires-supplementaires";
import { resoudreEnvois } from "@/lib/envois-supplementaires";
import {
  destinatairesZonePourRouteur,
  fusionnerDestinataires,
} from "@/lib/zones-wifi";
import type { EnvoiSupplementaire } from "@/lib/envois-supplementaires";
import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";
import { dechiffrer } from "@/lib/chiffrement-serveur";

// Donne a n8n les parametres d'UN job (id = runId). Route signee : les
// secrets dechiffres ne transitent ici que pendant une execution autorisee,
// jamais vers le navigateur, jamais dans les journaux ni les exports.
// Si Mikhmon exige encore le mot de passe initial (mikhmon/1234), refus :
// le changement de mot de passe est obligatoire avant la production.
type LigneRun = {
  run_id: string;
  tenant_id: string;
  utilisateur_id: string;
  router_connection_id: number | null;
  mikhmon_connection_id: number | null;
  profil: string;
  quantite_demandee: number;
  seuil: number | null;
  quantite_cible: number | null;
  canal_envoi: string;
  destinataire: string | null;
  duree_lot: string | null;
  statut: string;
  simulation: boolean;
};

type LigneConnexion = {
  id: number;
  tenant_id: string;
  nom: string;
  nom_ticket: string | null;
  variante_mikhmon: string;
  url_mikhmon: string;
  hote: string | null;
  port: number;
  identifiant_mikhmon: string;
  mot_de_passe_mikhmon_chiffre: string;
  adresse_routeros: string;
  utilisateur_lecture: string;
  utilisateur_correction: string;
  mot_de_passe_lecture_chiffre: string | null;
  mot_de_passe_correction_chiffre: string;
  mikhmon_change_requis: boolean;
  serveur_hotspot: string | null;
};

// Depuis le conteneur n8n (Docker, macOS), le Mikhmon local se joint via
// host.docker.internal : derive de l'URL stockee, jamais codee en dur.
function urlDepuisN8n(urlStockee: string): string {
  return urlStockee
    .replace("://127.0.0.1", "://host.docker.internal")
    .replace("://localhost", "://host.docker.internal");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // La requete GET sans corps se signe sur sa charge vide : on verifie les
  // en-tetes puis on lie x-run-id a l'identifiant demande.
  const controle = await verifierAppelInterne(_req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const id = (await params).id;
  if (controle.appel.runId !== id) {
    return Response.json({ error: "runId incohérent." }, { status: 400 });
  }

  const { rows: runs } = await db.query(
    `SELECT run_id, tenant_id, utilisateur_id, router_connection_id,
       mikhmon_connection_id, profil, quantite_demandee, seuil,
       quantite_cible, canal_envoi, destinataire, whatsapp_recipient,
       printnode_printer_id, statut, simulation,
       destinataires_supplementaires, approbation_requise, approbation_canal
     FROM ticket_generation_runs WHERE run_id = $1`,
    [id],
  );
  const lignes = runs as (LigneRun & {
    approbation_requise: boolean; approbation_canal: string;
    whatsapp_recipient: string | null;
    printnode_printer_id: string | null;
    destinataires_supplementaires: DestinataireSupplementaire[] | null;
  })[];
  if (lignes.length === 0) {
    return Response.json({ error: "Run inconnu." }, { status: 404 });
  }
  const run = lignes[0];
  if (run.statut === "termine" || run.statut === "echoue") {
    return Response.json({ error: "Run déjà clôturé." }, { status: 409 });
  }
  if (run.router_connection_id === null) {
    return Response.json({ error: "Run sans routeur." }, { status: 422 });
  }

  const { rows: connexions } = await db.query(
    `SELECT id, tenant_id, nom, nom_ticket, variante_mikhmon, url_mikhmon, hote, port,
       identifiant_mikhmon, mot_de_passe_mikhmon_chiffre, adresse_routeros,
       utilisateur_lecture, utilisateur_correction,
       mot_de_passe_lecture_chiffre, mot_de_passe_correction_chiffre,
       mikhmon_change_requis, serveur_hotspot
     FROM configurations_routeurs
     WHERE id = $1 AND tenant_id = $2`,
    [run.router_connection_id, run.tenant_id],
  );
  const lignesConnexion = connexions as LigneConnexion[];
  if (lignesConnexion.length === 0) {
    return Response.json({ error: "Connexion introuvable." }, { status: 404 });
  }
  const connexion = lignesConnexion[0];
  if (connexion.mikhmon_change_requis) {
    return Response.json(
      { error: "Mot de passe Mikhmon par défaut : changement requis." },
      { status: 428 },
    );
  }

  let telegram: Record<string, unknown> | null = null;
  let whatsapp: Record<string, unknown> | null = null;
  let printnode: Record<string, unknown> | null = null;
  let supplementaires: EnvoiSupplementaire[] = [];
  try {
    // Copie systématique : destinataires de la règle + numéros de la
    // zone Wi-Fi du routeur (admin, gérant, vendeurs, en WhatsApp).
    const deLaZone = await destinatairesZonePourRouteur(
      run.tenant_id, run.router_connection_id);
    supplementaires = await resoudreEnvois(
      run.tenant_id,
      fusionnerDestinataires(
        lignes[0].destinataires_supplementaires ?? [], deLaZone),
    );
    if (run.canal_envoi === "telegram" || run.approbation_canal === "telegram") {
      const { rows } = await db.query(
        `SELECT chat_id, jeton_chiffre, bot_verifie, statut_connexion
         FROM configurations_telegram WHERE tenant_id = $1`,
        [run.tenant_id],
      );
      const lignesTelegram = rows as {
        chat_id: string; jeton_chiffre: string | null;
        bot_verifie: boolean; statut_connexion: string;
      }[];
      if (lignesTelegram.length > 0) {
        const bot = lignesTelegram[0];
        telegram = {
          chatId: bot.chat_id,
          botVerifie: bot.bot_verifie,
          statutConnexion: bot.statut_connexion,
          // En mode « bot central », le jeton n'est volontairement pas
          // stocké dans la base : il reste dans l'environnement serveur.
          // n8n doit néanmoins le recevoir pendant le job signé.
          jeton: bot.jeton_chiffre
            ? dechiffrer(bot.jeton_chiffre)
            : (process.env.TELEGRAM_BOT_TOKEN ?? null),
        };
      }
    }
    if (run.canal_envoi === "whatsapp" || run.approbation_canal === "whatsapp") {
      const { rows } = await db.query(
        `SELECT webhook_url, secret_chiffre, destinataire_defaut,
           statut_connexion FROM configurations_whatsapp
         WHERE tenant_id = $1`,
        [run.tenant_id],
      );
      const lignesWhatsapp = rows as {
        webhook_url: string; secret_chiffre: string | null;
        destinataire_defaut: string; statut_connexion: string;
      }[];
      if (lignesWhatsapp.length > 0) {
        const canalWhatsapp = lignesWhatsapp[0];
        whatsapp = {
          webhookUrl: canalWhatsapp.webhook_url,
          destinataire:
            run.destinataire ?? canalWhatsapp.destinataire_defaut,
          statutConnexion: canalWhatsapp.statut_connexion,
          secret: canalWhatsapp.secret_chiffre
            ? dechiffrer(canalWhatsapp.secret_chiffre)
            : null,
        };
      }
    }
    if (run.canal_envoi === "printnode") {
      const { rows } = await db.query(
        `SELECT cle_chiffre, printer_id, nom_imprimante, format_papier,
           statut_connexion FROM configurations_printnode
         WHERE tenant_id = $1`,
        [run.tenant_id],
      );
      const lignesPrint = rows as {
        cle_chiffre: string | null; printer_id: number | null;
        nom_imprimante: string | null; format_papier: string;
        statut_connexion: string;
      }[];
      if (lignesPrint.length > 0) {
        const imprimante = lignesPrint[0];
        if (imprimante.statut_connexion !== "en-ligne") {
          return Response.json(
            { error: "Imprimante PrintNode non testée." },
            { status: 428 },
          );
        }
        printnode = {
          printerId: imprimante.printer_id,
          nomImprimante: imprimante.nom_imprimante,
          formatPapier: imprimante.format_papier,
          cle: imprimante.cle_chiffre
            ? dechiffrer(imprimante.cle_chiffre)
            : null,
        };
      }
    }
  } catch {
    return Response.json({ error: "Canal de livraison illisible." },
      { status: 500 });
  }

  // Destinataire d'approbation : Telegram = chat de l'espace ;
  // WhatsApp = numero admin de la zone (repli gerant, puis defaut).
  let approbation: Record<string, unknown> | null = null;
  if (run.approbation_requise) {
    let destinataireApprobation = "";
    if (run.approbation_canal === "telegram") {
      destinataireApprobation = String(
        (telegram as { chatId?: string } | null)?.chatId ?? "");
    } else {
      const deLaZone = await destinatairesZonePourRouteur(
        run.tenant_id, run.router_connection_id);
      destinataireApprobation = deLaZone[0]?.valeur
        ?? String((whatsapp as { destinataire?: string } | null)
          ?.destinataire ?? "");
    }
    approbation = {
      requise: true,
      canal: run.approbation_canal,
      destinataire: destinataireApprobation,
    };
  }

  let motDePasseMikhmon: string;
  let motDePasseLecture: string | null;
  let motDePasseEcriture: string;
  try {
    motDePasseMikhmon = dechiffrer(connexion.mot_de_passe_mikhmon_chiffre);
    motDePasseLecture = connexion.mot_de_passe_lecture_chiffre
      ? dechiffrer(connexion.mot_de_passe_lecture_chiffre)
      : null;
    motDePasseEcriture = dechiffrer(connexion.mot_de_passe_correction_chiffre);
  } catch {
    return Response.json({ error: "Secrets illisibles." }, { status: 500 });
  }

  return Response.json({
    data: {
      runId: run.run_id,
      tenantId: run.tenant_id,
      simulation: run.simulation,
      routeur: {
        nom: connexion.nom,
        nomTicket: connexion.nom_ticket || connexion.nom,
        adresse: connexion.adresse_routeros,
        utilisateurLecture: connexion.utilisateur_lecture,
        motDePasseLecture,
        utilisateurEcriture: connexion.utilisateur_correction,
        motDePasseEcriture,
      },
      mikhmon: {
        variante: connexion.variante_mikhmon,
        url: connexion.url_mikhmon,
        urlDepuisN8n: urlDepuisN8n(connexion.url_mikhmon),
        identifiant: connexion.identifiant_mikhmon,
        motDePasse: motDePasseMikhmon,
        serveurHotspot: connexion.serveur_hotspot,
        note: "Les tickets sont créés sur RouterOS et deviennent " +
          "visibles automatiquement dans Mikhmon.",
      },
      lot: {
        profil: run.profil,
        quantite: run.quantite_demandee,
        seuil: run.seuil,
        quantiteCible: run.quantite_cible,
      },
      livraison: {
        canal: run.canal_envoi,
        destinataire: run.destinataire,
        telegram,
        whatsapp,
        printnode,
        approbation,
        supplementaires,
      },
    },
  });
}
