import { session } from "@/lib/session";
import {
  enregistrerReglages,
  lireReglages,
} from "@/lib/runs-tickets";
import type { ReglagesTickets } from "@/lib/runs-tickets";

// Parametres du compte : valeurs par defaut du formulaire de generation
// (profil, quantite entiere, canal, connexions). Quantites et durees en
// entiers uniquement, jamais de flottant.
export async function GET() {
  const ctx = await session();
  try {
    const reglages = await lireReglages(ctx);
    return Response.json({ data: { reglages } });
  } catch (e) {
    console.error("[parametres-compte]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const ctx = await session();
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const quantiteBrute = b["quantiteDefaut"];
  const mikhmonBrut = b["mikhmonConnectionId"];
  const routeurBrut = b["routerConnectionId"];
  const reglages: ReglagesTickets = {
    profilDefaut:
      typeof b["profilDefaut"] === "string" ? b["profilDefaut"] : null,
    quantiteDefaut: typeof quantiteBrute === "number"
      ? quantiteBrute
      : 0,
    canalDefaut: typeof b["canalDefaut"] === "string" ? b["canalDefaut"] : "",
    mikhmonConnectionId: Number.isInteger(mikhmonBrut)
      ? (mikhmonBrut as number)
      : null,
    routerConnectionId: Number.isInteger(routeurBrut)
      ? (routeurBrut as number)
      : null,
  };
  try {
    const resultat = await enregistrerReglages(ctx, reglages);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    return Response.json({ data: { reglages: resultat.reglages } });
  } catch (e) {
    console.error("[parametres-compte]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
