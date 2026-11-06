import { listerEspacesDe } from "@/lib/membres";
import { reponseAuthentification, session } from "@/lib/session";

// GET : les espaces de l'utilisateur connecté (le sien + ceux où il
// est invité), avec son rôle dans chacun.
export async function GET() {
  try {
    const ctx = await session();
    const espaces = await listerEspacesDe(ctx.utilisateurId);
    return Response.json({ data: { espaces, espaceActuel: ctx.tenantId } });
  } catch (e) {
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[espaces] Lecture impossible.");
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
