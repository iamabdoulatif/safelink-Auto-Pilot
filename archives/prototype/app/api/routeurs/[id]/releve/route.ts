import { db } from "@/lib/db";
import { collecter } from "@/lib/diagnostic/collecte";
import { analyser } from "@/lib/diagnostic/regles";
import { ErreurRouterOS } from "@/lib/routeros";

// Next.js 16 : params est une PROMESSE. On l'attend.
export async function POST(req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routeurId = Number(id);
  if (!Number.isInteger(routeurId)) {
    return Response.json({ error: "Identifiant de routeur invalide." },
      { status: 400 });
  }

  const { rows } = await db.query(
    "SELECT id, url_base FROM routeurs WHERE id = $1 AND actif = true", [routeurId]);
  if (rows.length === 0) {
    return Response.json({ error: "Routeur inconnu." }, { status: 404 });
  }

  try {
    const { releveId, statut } = await collecter(routeurId, rows[0].url_base);
    const constats = await analyser(routeurId, releveId);
    return Response.json({ data: { releveId, statut, constats } });
  } catch (e) {
    // On journalise le detail cote serveur, on renvoie une phrase au client.
    console.error("[releve]", e);
    if (e instanceof ErreurRouterOS) {
      return Response.json(
        { error: "Le routeur n'a pas repondu correctement. Verifiez qu'il est "
          + "joignable et que le service www-ssl est actif." },
        { status: 502 });
    }
    return Response.json({ error: "Echec du releve." }, { status: 500 });
  }
}
