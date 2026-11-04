import { session } from "@/lib/session";
import { listerRuns } from "@/lib/runs-tickets";

// Historique des lots de l'espace (runs recents, isoles par tenant).
// Seuls profil, quantites, canal et statuts sont conserves : les mots de
// passe des tickets vivent dans le routeur, jamais ici.
export async function GET(req: Request) {
  const ctx = await session();
  const limite = Number(new URL(req.url).searchParams.get("limite") ?? 50);
  try {
    const lots = await listerRuns(ctx, limite);
    return Response.json({ data: { lots } });
  } catch (e) {
    console.error("[historique]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
