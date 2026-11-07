import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { conditionVue } from "@/lib/historique-vues";
import type { VueHistorique } from "@/lib/historique-vues";

// Historique des générations, en trois vues qui protègent l'écran
// des contrôles toutes les 15 minutes :
// - significatifs (défaut) : générations réelles, échecs, attentes ;
// - controles : la routine (0 créé, aucun échec), archivable ;
// - archives : la routine de plus de 30 jours, supprimable (admin).
// Pagination par curseur (avant = ISO du dernier élément reçu).
// Seuls profil, quantités, canal et statuts : aucun secret.
const VUES: VueHistorique[] = ["significatifs", "controles", "archives"];

export async function GET(req: Request) {
  try {
    const ctx = await session();
    const url = new URL(req.url);
    const vueBrute = url.searchParams.get("vue") ?? "significatifs";
    const vue = (VUES as string[]).includes(vueBrute)
      ? (vueBrute as VueHistorique) : "significatifs";
    const limiteBrute = Number(url.searchParams.get("limite") ?? 20);
    const limite = Number.isInteger(limiteBrute)
      ? Math.min(100, Math.max(1, limiteBrute)) : 20;
    const avant = url.searchParams.get("avant");

    const conditions = [conditionVue(vue)];
    const params: unknown[] = [ctx.tenantId];
    if (avant && !Number.isNaN(Date.parse(avant))) {
      params.push(new Date(avant).toISOString());
      conditions.push(`r.created_at < $${params.length}`);
    }
    const { rows } = await db.query(
      `SELECT r.run_id, r.profil, r.stock_avant, r.seuil,
         r.quantite_demandee, r.quantite_creee, r.canal_envoi,
         r.destinataire, r.statut, r.erreur, r.simulation,
         r.created_at AS debut_le, r.termine_le AS fin_le,
         cr.nom AS routeur_nom
       FROM ticket_generation_runs r
       LEFT JOIN configurations_routeurs cr
         ON cr.id = r.router_connection_id AND cr.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 AND ${conditions.join(" AND ")}
       ORDER BY r.created_at DESC LIMIT ${limite}`,
      params,
    );
    const { rows: compteurs } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM ticket_generation_runs
          WHERE tenant_id = $1 AND created_at > now() - interval '30 days'
            AND quantite_creee > 0) AS generations,
         (SELECT COUNT(*) FROM ticket_generation_runs
          WHERE tenant_id = $1 AND statut = 'echoue') AS echecs,
         (SELECT COUNT(*) FROM ticket_generation_runs
          WHERE tenant_id = $1 AND archive = false AND quantite_creee = 0
            AND statut NOT IN ('echoue','en_attente','en_cours')
            AND erreur IS NULL) AS controles,
         (SELECT COUNT(*) FROM ticket_generation_runs
          WHERE tenant_id = $1 AND archive = true) AS archives`,
      [ctx.tenantId],
    );
    const c = (compteurs as Record<string, unknown>[])[0] ?? {};
    const nombre = (v: unknown) => Number(v ?? 0);
    return Response.json({
      data: {
        vue,
        lots: rows,
        compteurs: {
          generations: nombre(c["generations"]),
          echecs: nombre(c["echecs"]),
          controles: nombre(c["controles"]),
          archives: nombre(c["archives"]),
        },
      },
    });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

// Archiver la routine de plus de 30 jours (admin). Aucune génération
// réelle n'est touchée : quantite_creee = 0 et aucun échec exigés.
export async function POST(req: Request) {
  const ctx = await session().catch(() => null);
  if (!ctx) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json({ error: "Seul un admin peut archiver." },
      { status: 403 });
  }
  void req;
  const { rowCount } = await db.query(
    `UPDATE ticket_generation_runs SET archive = true
     WHERE tenant_id = $1 AND archive = false AND quantite_creee = 0
       AND statut NOT IN ('echoue', 'en_attente', 'en_cours')
       AND erreur IS NULL
       AND created_at < now() - interval '30 days'`,
    [ctx.tenantId],
  );
  return Response.json({ data: { archives: rowCount ?? 0 } });
}

// Supprimer définitivement les lignes archivées (admin, base
// uniquement : aucun effet routeur). Confirmation exacte exigée.
export async function DELETE(req: Request) {
  const ctx = await session().catch(() => null);
  if (!ctx) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json({ error: "Seul un admin peut supprimer." },
      { status: 403 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if ((corps as Record<string, unknown>)?.["confirmation"] !== "SUPPRIMER") {
    return Response.json({
      error: "Confirmation incorrecte : tapez SUPPRIMER.",
    }, { status: 400 });
  }
  const { rowCount } = await db.query(
    "DELETE FROM ticket_generation_runs WHERE tenant_id = $1 AND archive = true",
    [ctx.tenantId],
  );
  return Response.json({ data: { supprimes: rowCount ?? 0 } });
}
