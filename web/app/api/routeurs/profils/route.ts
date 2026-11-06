import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { listerProfilsHotspot } from "@/lib/connexions-routeur";

// Profils Hotspot disponibles (/ip/hotspot/profile, compte de lecture).
// Le mot de passe de lecture est fourni dans le corps, utilise une fois
// cote serveur, puis oublie : il n'est jamais stocke ni journalise.
export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "contributeur"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const idBrut = b["configurationId"];
  const motDePasse =
    typeof b["motDePasseLecture"] === "string" ? b["motDePasseLecture"] : "";
  if (!Number.isInteger(idBrut) || (idBrut as number) <= 0) {
    return Response.json({ error: "configurationId doit être un entier." },
      { status: 400 });
  }
  if (!motDePasse) {
    return Response.json(
      { error: "Mot de passe de lecture obligatoire." },
      { status: 400 });
  }
  try {
    const resultat = await listerProfilsHotspot(
      ctx, idBrut as number, motDePasse);
    if ("erreur" in resultat) {
      const absent = resultat.erreur.includes("introuvable");
      return Response.json(
        { error: resultat.erreur },
        { status: absent ? 404 : 502 },
      );
    }
    return Response.json({ data: { profils: resultat.profils } });
  } catch (e) {
    console.error("[profils-hotspot]", e);
    return Response.json({ error: "Lecture des profils impossible." },
      { status: 500 });
  }
}
