import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { db } from "@/lib/db";

// Approbation dans l'application : l'humain valide (ou refuse) une demande
// que n8n a mise en pause (node Wait, statut 'en_attente'). L'URL de reprise
// est un jeton a usage unique : consommee des l'usage, jamais rejouable.
// Reponses { data } ou { error }, jamais de secret.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const decision = (corps as Record<string, unknown>)["decision"];
  if (decision !== "approuver" && decision !== "refuser") {
    return Response.json({ error: "Décision invalide." }, { status: 400 });
  }

  try {
    const { rows } = await db.query<{
      id: number; url_reprise: string | null; statut: string;
    }>(
      `SELECT id, url_reprise, statut FROM executions_n8n
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const ex = rows[0];
    if (!ex) {
      return Response.json({ error: "Demande inconnue." }, { status: 404 });
    }
    if (ex.statut !== "en_attente" || !ex.url_reprise) {
      // Deja decidee, expiree ou consommee : l'URL n'est valable qu'une fois.
      return Response.json(
        { error: "Cette demande n'est plus en attente." }, { status: 410 });
    }

    // On appelle l'URL de reprise : n8n repart exactement ou il s'etait arrete.
    const url = ex.url_reprise + "?approved=" + (decision === "approuver");
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return Response.json(
        { error: "L'automatisation n'a pas pu reprendre." }, { status: 502 });
    }
    if (!res.ok) {
      return Response.json(
        { error: "L'automatisation n'a pas pu reprendre." }, { status: 502 });
    }

    // On consomme l'URL : un jeton a usage unique ne se garde pas.
    await db.query(
      "UPDATE executions_n8n SET statut = $2, url_reprise = NULL " +
        "WHERE id = $1 AND tenant_id = $3",
      [ex.id, decision === "approuver" ? "lance" : "termine", tenantId],
    );
    return Response.json({ data: { reprise: true, decision } });
  } catch (e) {
    console.error("[approbations]", e);
    return Response.json({ error: "Approbation impossible." },
      { status: 500 });
  }
}
