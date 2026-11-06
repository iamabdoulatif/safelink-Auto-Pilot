import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";
import { dechiffrer } from "@/lib/chiffrement-serveur";

// Configuration signée d'UN rapport (id = rapportId) : identifiants
// RouterOS en lecture seule, période, canal et destinataires de la
// zone. Puis clôture signée après envoi. Secrets déchiffrés uniquement
// pendant l'exécution autorisée, jamais journalisés.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const controle = await verifierAppelInterne(_req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const id = (await params).id;
  if (controle.appel.runId !== id) {
    return Response.json({ error: "rapportId incohérent." }, { status: 400 });
  }
  const { rows } = await db.query(
    `SELECT e.rapport_id, e.tenant_id, e.router_connection_id,
        e.periode_debut::text AS debut, e.periode_fin::text AS fin,
        e.canal, e.statut,
        r.nom AS routeur_nom, r.adresse_routeros,
        r.utilisateur_lecture, r.utilisateur_correction,
        r.mot_de_passe_lecture_chiffre, r.mot_de_passe_correction_chiffre,
        z.localisation, z.commune, z.numero_admin, z.numero_gerant,
        z.numeros_vendeurs
     FROM rapports_ventes_envois e
     JOIN configurations_routeurs r
       ON r.id = e.router_connection_id AND r.tenant_id = e.tenant_id
     LEFT JOIN zones_wifi_destinataires z
       ON z.router_connection_id = e.router_connection_id
       AND z.tenant_id = e.tenant_id
     WHERE e.rapport_id = $1`,
    [id],
  );
  const lignes = rows as Record<string, unknown>[];
  if (lignes.length === 0) {
    return Response.json({ error: "Rapport inconnu." }, { status: 404 });
  }
  const l = lignes[0];
  if (l["statut"] === "envoye") {
    return Response.json({ error: "Rapport déjà envoyé." }, { status: 409 });
  }
  let motDePasse: string | null = null;
  let utilisateur = String(l["utilisateur_lecture"] ?? "");
  try {
    if (l["mot_de_passe_lecture_chiffre"]) {
      motDePasse = dechiffrer(l["mot_de_passe_lecture_chiffre"] as string);
    }
    if (!motDePasse && l["mot_de_passe_correction_chiffre"]) {
      motDePasse = dechiffrer(l["mot_de_passe_correction_chiffre"] as string);
      utilisateur = String(l["utilisateur_correction"] ?? "");
    }
  } catch {
    return Response.json({ error: "Secrets illisibles." }, { status: 500 });
  }
  if (!motDePasse) {
    return Response.json({ error: "Mot de passe RouterOS manquant." },
      { status: 428 });
  }

  const { rows: wa } = await db.query(
    `SELECT webhook_url, destinataire_defaut, statut_connexion
     FROM configurations_whatsapp WHERE tenant_id = $1`,
    [l["tenant_id"]],
  );
  const { rows: tg } = await db.query(
    "SELECT chat_id, jeton_chiffre FROM configurations_telegram WHERE tenant_id = $1",
    [l["tenant_id"]],
  );
  const ligneWa = (wa as Record<string, unknown>[])[0];
  const ligneTg = (tg as Record<string, unknown>[])[0];
  let jetonTelegram: string | null = null;
  try {
    jetonTelegram = ligneTg?.["jeton_chiffre"]
      ? dechiffrer(ligneTg["jeton_chiffre"] as string)
      : (process.env.TELEGRAM_BOT_TOKEN ?? null);
  } catch {
    jetonTelegram = null;
  }

  return Response.json({
    data: {
      rapportId: l["rapport_id"],
      tenantId: l["tenant_id"],
      periode: { debut: l["debut"], fin: l["fin"] },
      canal: l["canal"],
      zone: {
        nom: l["routeur_nom"],
        localisation: l["localisation"] ?? "",
        commune: l["commune"] ?? "",
        numeroAdmin: l["numero_admin"] ?? "",
        numeroGerant: l["numero_gerant"] ?? "",
        numerosVendeurs: Array.isArray(l["numeros_vendeurs"])
          ? l["numeros_vendeurs"] : [],
      },
      routeur: {
        adresse: String(l["adresse_routeros"] ?? "").replace(/\/$/, ""),
        utilisateur,
        motDePasse,
      },
      canaux: {
        telegramChatId: ligneTg?.["chat_id"] ?? "",
        telegramBotToken: jetonTelegram ?? "",
        whatsappWebhookUrl: ligneWa?.["webhook_url"] ?? "",
      },
    },
  });
}

// Clôture signée : total calculé par n8n, aucun secret, aucun ticket.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const id = (await params).id;
  if (controle.appel.runId !== id) {
    return Response.json({ error: "rapportId incohérent." }, { status: 400 });
  }
  const total = controle.appel.corps["totalVendu"];
  const tickets = controle.appel.corps["ticketsVendus"];
  const { rowCount } = await db.query(
    `UPDATE rapports_ventes_envois
     SET statut = 'envoye', envoye_le = now(), total_vendu = $2,
         tickets_vendus = $3
     WHERE rapport_id = $1 AND statut <> 'envoye'`,
    [id, Number.isInteger(total) ? total : null,
      Number.isInteger(tickets) ? tickets : null],
  );
  if (rowCount) {
    await db.query(
      `UPDATE zones_wifi_destinataires z
       SET dernier_rapport_le = now(), updated_at = now()
       FROM rapports_ventes_envois e
       WHERE e.rapport_id = $1
         AND z.tenant_id = e.tenant_id
         AND z.router_connection_id = e.router_connection_id`,
      [id],
    );
  }
  return Response.json({ data: { rapportId: id, envoye: rowCount === 1 } });
}
