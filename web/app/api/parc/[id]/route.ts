import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  modifierRouteurParc,
  supprimerRouteurParc,
} from "@/lib/parc-routeurs";

// Un routeur du parc : renommer (nom + URL affiches) ou retirer
// (suppression locale, le routeur lui-meme est intact). Isole par tenant,
// reponses { data } ou { error }, jamais de secret.
export async function PUT(
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
  const b = (corps ?? {}) as Record<string, unknown>;
  try {
    const resultat = await modifierRouteurParc(
      { tenantId, utilisateurId },
      id,
      {
        nom: typeof b["nom"] === "string" ? b["nom"] : "",
        urlBase: typeof b["url_base"] === "string" ? b["url_base"] : "",
      },
    );
    if ("erreur" in resultat) {
      const statut = resultat.erreur === "Routeur introuvable." ? 404 : 400;
      return Response.json({ error: resultat.erreur }, { status: statut });
    }
    return Response.json({ data: { modifie: true } });
  } catch (e) {
    console.error("[parc]", e);
    return Response.json({ error: "Modification impossible." },
      { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
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
  try {
    const resultat = await supprimerRouteurParc(
      { tenantId, utilisateurId }, id);
    if ("erreur" in resultat) {
      const statut = resultat.erreur === "Routeur introuvable."
        ? 404
        : 409;
      return Response.json({ error: resultat.erreur }, { status: statut });
    }
    return Response.json({ data: { supprime: true } });
  } catch (e) {
    console.error("[parc]", e);
    return Response.json({ error: "Suppression impossible." },
      { status: 500 });
  }
}
