import { session } from "@/lib/session";
import { listerHistorique } from "@/lib/historique";

// Historique des generations de l'espace : runs + lots, sans aucun
// secret (ni mot de passe Mikhmon/RouterOS/tickets, ni jeton, ni cle).
export async function GET(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const limite = Number(
    new URL(req.url).searchParams.get("limite") ?? "50");
  try {
    const lignes = await listerHistorique(
      { tenantId, utilisateurId }, limite);
    return Response.json({ data: lignes });
  } catch (e) {
    console.error("[historique]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
