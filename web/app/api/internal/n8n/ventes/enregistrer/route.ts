import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";

// Enregistre la première utilisation relevée de chaque ticket.
// Le workflow n'envoie que des empreintes SHA-256 des codes : le
// code et le mot de passe du ticket ne quittent jamais le routeur.
// Un ticket déjà connu est ignoré (ON CONFLICT DO NOTHING) : son
// heure de première utilisation ne bouge plus. L'heure retenue
// est l'heure serveur de ce premier relevé ; elle n'est marquée
// « connue » que si le lot date d'hier ou d'aujourd'hui, sinon le
// rapport retombe sur la date du lot (voir migration 032).
const MAX_TICKETS_PAR_RELEVE = 5000;
const EMPREINTE_OK = /^[0-9a-f]{64}$/;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

type TicketReleve = {
  hash: string;
  profil: string;
  lot: number | null;
  lotDate: string | null;
};

function validerTicket(brut: unknown): TicketReleve | null {
  if (typeof brut !== "object" || brut === null) return null;
  const t = brut as Record<string, unknown>;
  if (typeof t["hash"] !== "string" || !EMPREINTE_OK.test(t["hash"])) {
    return null;
  }
  const profil = typeof t["profil"] === "string" ? t["profil"].slice(0, 60) : "";
  const lot = Number.isInteger(t["lot"]) && Number(t["lot"]) >= 0
    ? Number(t["lot"]) : null;
  const lotDate = typeof t["lotDate"] === "string" && DATE_OK.test(t["lotDate"])
    ? t["lotDate"] : null;
  return { hash: t["hash"], profil, lot, lotDate };
}

export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const tenantId = controle.appel.corps["tenantId"];
  const routerConnectionId = controle.appel.corps["routerConnectionId"];
  const ticketsBruts = controle.appel.corps["tickets"];
  if (typeof tenantId !== "string" || !tenantId
    || !Number.isInteger(routerConnectionId)
    || !Array.isArray(ticketsBruts)
    || ticketsBruts.length > MAX_TICKETS_PAR_RELEVE) {
    return Response.json({ error: "Relevé de ventes invalide." },
      { status: 400 });
  }
  const tickets: TicketReleve[] = [];
  for (const brut of ticketsBruts) {
    const ticket = validerTicket(brut);
    if (!ticket) {
      return Response.json({ error: "Empreinte de ticket invalide." },
        { status: 400 });
    }
    tickets.push(ticket);
  }
  try {
    // Le routeur doit appartenir à l'espace : sinon rien n'est écrit.
    const { rows: routeurs } = await db.query(
      `SELECT id FROM configurations_routeurs
       WHERE id = $1 AND tenant_id = $2`,
      [routerConnectionId, tenantId],
    );
    if (routeurs.length === 0) {
      return Response.json({ error: "Routeur inconnu pour ce relevé." },
        { status: 404 });
    }
    let enregistres = 0;
    for (const t of tickets) {
      const { rowCount } = await db.query(
        `INSERT INTO suivi_ventes_tickets
           (tenant_id, router_connection_id, ticket_hash, profil, lot,
            lot_date, premiere_utilisation_le, heure_connue)
         VALUES ($1, $2, $3, $4, $5, $6, now(),
                 $6::date IS NULL OR $6::date >= CURRENT_DATE - 1)
         ON CONFLICT (tenant_id, router_connection_id, ticket_hash)
         DO NOTHING`,
        [tenantId, routerConnectionId, t.hash, t.profil, t.lot, t.lotDate],
      );
      enregistres += rowCount ?? 0;
    }
    return Response.json({ data: { enregistres } });
  } catch {
    return Response.json({ error: "Enregistrement du relevé impossible." },
      { status: 500 });
  }
}
