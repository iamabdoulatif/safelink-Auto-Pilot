import { db } from "@/lib/db";
import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";

// Tableau de reapprovisionnement : chaque abonnement avec son etat
// (derniere verification, stock, seuil, cible, prochain passage,
// statut du workflow, derniere erreur, dernier lot). Les donnees
// secretes n'y figurent jamais.
export async function GET() {
  const { tenantId, utilisateurId } = await session();
  void utilisateurId;
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.profil, a.seuil, a.quantite_cible, a.canal,
         a.destinataire, a.actif, a.derniere_verif_le, a.dernier_stock,
         a.derniere_erreur, a.configuration_routeur_id,
         COALESCE(c.nom, r.nom) AS routeur_nom,
         a.derniere_verif_le + interval '15 minutes'
           AS prochaine_verification,
         d.statut AS statut_run, d.quantite_creee AS dernier_lot,
         d.termine_le AS dernier_lot_le, d.erreur AS erreur_run
       FROM abonnements_tickets a
       LEFT JOIN configurations_routeurs c
         ON c.id = a.configuration_routeur_id
       LEFT JOIN routeurs r ON r.id = a.routeur_id
       LEFT JOIN LATERAL (
         SELECT statut, quantite_creee, termine_le, erreur
         FROM ticket_generation_runs g
         WHERE g.tenant_id = a.tenant_id AND g.profil = a.profil
           AND COALESCE(g.router_connection_id, -1)
             = COALESCE(a.configuration_routeur_id, -1)
         ORDER BY g.created_at DESC LIMIT 1
       ) d ON true
       WHERE a.tenant_id = $1
       ORDER BY routeur_nom, a.profil`,
      [tenantId]);
    return Response.json({ data: rows });
  } catch (e) {
    console.error("[abonnements]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

// Abonne un routeur+profil a la generation automatique : seuil de stock
// (defaut 50, modifiable), quantite cible (defaut 120), canal d'envoi
// et destinataires. L'activation explicite vaut validation humaine
// prealable. Reinscrire le meme couple met a jour (pas de doublon) :
// l'inscription est idempotente. Isole par tenant.
const CANAUX = [
  "interface",
  "telegram",
  "whatsapp",
  "printnode",
  "pdf",
] as const;

export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "contributeur"))) {
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
  // Nouveau chemin (configuration chiffree) ou parc historique.
  const configurationId = b["configuration_routeur_id"] ?? null;
  const routeurId = b["routeur_id"] ?? null;
  const profil = typeof b["profil"] === "string" ? b["profil"].trim() : "";
  const seuil = b["seuil"] === undefined ? 50 : b["seuil"];
  const cible = b["quantite_cible"] === undefined
    ? 120
    : b["quantite_cible"];
  const canal = typeof b["canal"] === "string" ? b["canal"] : "telegram";
  const destinataire = typeof b["destinataire"] === "string"
    ? b["destinataire"].trim() : "";
  const chatTelegram = typeof b["telegram_chat_id"] === "string"
    ? b["telegram_chat_id"].trim() : "";
  const destWhatsApp = typeof b["whatsapp_recipient"] === "string"
    ? b["whatsapp_recipient"].trim() : "";
  const impPrintNode = typeof b["printnode_printer_id"] === "string"
    ? b["printnode_printer_id"].trim() : "";
  const actif = b["actif"] === undefined ? true : b["actif"] === true;

  if (configurationId !== null && !Number.isInteger(configurationId)) {
    return Response.json(
      { error: "configuration_routeur_id doit être un entier ou absent." },
      { status: 400 });
  }
  if (routeurId !== null && !Number.isInteger(routeurId)) {
    return Response.json({ error: "routeur_id doit être un entier ou absent." },
      { status: 400 });
  }
  if (configurationId === null && routeurId === null) {
    return Response.json(
      { error: "Routeur manquant : configuration_routeur_id ou routeur_id." },
      { status: 400 });
  }
  if (!profil || profil.length > 64) {
    return Response.json({ error: "profil obligatoire (1 a 64 caracteres)." },
      { status: 400 });
  }
  // 0 = pause sans supprimer : la ronde ignore, l'historique reste.
  if (!Number.isInteger(seuil) || (seuil as number) < 0
    || (seuil as number) > 10000) {
    return Response.json(
      { error: "seuil doit etre un entier entre 0 et 10000." },
      { status: 400 });
  }
  if (!Number.isInteger(cible) || (cible as number) < 1
    || (cible as number) > 500) {
    return Response.json(
      { error: "quantite_cible doit etre un entier entre 1 et 500." },
      { status: 400 });
  }
  if (!(CANAUX as readonly string[]).includes(canal)) {
    return Response.json(
      { error: "canal inconnu : interface, telegram, whatsapp, printnode ou pdf." },
      { status: 400 });
  }
  if (destinataire.length > 128 || chatTelegram.length > 32
    || destWhatsApp.length > 128 || impPrintNode.length > 32) {
    return Response.json({ error: "Destinataire trop long." },
      { status: 400 });
  }

  try {
    if (configurationId !== null) {
      const { rows: configs } = await db.query(
        `SELECT id FROM configurations_routeurs
         WHERE id = $1 AND tenant_id = $2 AND actif = true`,
        [configurationId, tenantId]);
      if (configs.length === 0) {
        return Response.json({ error: "Configuration inconnue." },
          { status: 404 });
      }
    } else {
      const { rows: routeurs } = await db.query(
        "SELECT id FROM routeurs WHERE id = $1 AND actif = true",
        [routeurId]);
      if (routeurs.length === 0) {
        return Response.json({ error: "Routeur inconnu." }, { status: 404 });
      }
    }

    // Reinscription idempotente : les lignes sans routeur_id (NULL) ne
    // declenchent jamais ON CONFLICT, d'ou la recherche prealable.
    const { rows: existants } = await db.query<{ id: number }>(
      `SELECT id FROM abonnements_tickets
       WHERE tenant_id = $1 AND profil = $2
         AND COALESCE(routeur_id, -1) = COALESCE($3, -1)
         AND COALESCE(configuration_routeur_id, -1) = COALESCE($4, -1)`,
      [tenantId, profil, routeurId, configurationId]);
    const dest = destinataire || chatTelegram || destWhatsApp
      || impPrintNode || null;
    let lignes: Record<string, unknown>[];
    if (existants.length > 0) {
      const { rows } = await db.query(
        `UPDATE abonnements_tickets
         SET seuil=$2, quantite_cible=$3, canal=$4, destinataire=$5,
             telegram_chat_id=$6, whatsapp_recipient=$7,
             printnode_printer_id=$8, actif=$9
         WHERE id=$1
         RETURNING id, routeur_id, configuration_routeur_id, profil, seuil,
           quantite_cible, canal, destinataire, actif`,
        [existants[0].id, seuil, cible, canal, dest,
          chatTelegram || null, destWhatsApp || null, impPrintNode || null,
          actif]);
      lignes = rows as Record<string, unknown>[];
    } else {
      const { rows } = await db.query(
        `INSERT INTO abonnements_tickets
           (tenant_id, routeur_id, configuration_routeur_id, profil, seuil,
            quantite_cible, canal, destinataire, telegram_chat_id,
            whatsapp_recipient, printnode_printer_id, actif)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, routeur_id, configuration_routeur_id, profil, seuil,
           quantite_cible, canal, destinataire, actif`,
        [tenantId, routeurId, configurationId, profil, seuil, cible, canal,
          dest, chatTelegram || null, destWhatsApp || null,
          impPrintNode || null, actif]);
      lignes = rows as Record<string, unknown>[];
    }
    const rows = lignes;
    await db.query(
      `INSERT INTO espaces (tenant_id, utilisateur_id)
       VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, utilisateurId]);
    return Response.json({ data: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("[abonnements]", e);
    return Response.json({ error: "Echec de l'abonnement." },
      { status: 500 });
  }
}
