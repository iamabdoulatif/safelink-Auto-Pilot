import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  lireReglages,
  enregistrerReglages,
} from "@/lib/runs-tickets";
import type { ReglagesTickets } from "@/lib/runs-tickets";

// Parametres du compte : valeurs par defaut du formulaire de generation
// (profil, quantite, canal, connexions). Un par espace, ecrasement simple.
export async function GET() {
  const { tenantId, utilisateurId } = await session();
  try {
    const reglages = await lireReglages({ tenantId, utilisateurId });
    return Response.json({ data: reglages });
  } catch (e) {
    console.error("[parametres]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const ctx = { tenantId, utilisateurId };
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const reglages: ReglagesTickets = {
    profilDefaut: typeof b["profil_defaut"] === "string"
      ? b["profil_defaut"] : null,
    quantiteDefaut: typeof b["quantite_defaut"] === "number"
      ? b["quantite_defaut"] : 10,
    canalDefaut: typeof b["canal_defaut"] === "string"
      ? b["canal_defaut"] : "interface",
    mikhmonConnectionId:
      typeof b["mikhmon_connection_id"] === "number"
        ? b["mikhmon_connection_id"] : null,
    routerConnectionId:
      typeof b["router_connection_id"] === "number"
        ? b["router_connection_id"] : null,
  };
  try {
    const resultat = await enregistrerReglages(ctx, reglages);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    return Response.json({ data: resultat.reglages });
  } catch (e) {
    console.error("[parametres]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
