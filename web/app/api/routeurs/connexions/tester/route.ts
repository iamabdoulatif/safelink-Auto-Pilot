import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { testerConnexionRouteur } from "@/lib/connexions-routeur";

// Teste la connexion RouterOS COTE SERVEUR avec le compte de lecture
// seule. Le mot de passe transite uniquement dans le corps de l'appel,
// n'est jamais stocke ni journalise : seul le statut est memorise.
export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
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
      { error: "Mot de passe de lecture obligatoire pour le test." },
      { status: 400 });
  }
  try {
    const resultat = await testerConnexionRouteur(
      ctx, idBrut as number, motDePasse);
    if ("erreur" in resultat) {
      const absent = resultat.erreur.includes("introuvable");
      return Response.json(
        { error: resultat.erreur },
        { status: absent ? 404 : 502 },
      );
    }
    return Response.json({ data: { en_ligne: true, version: resultat.version } });
  } catch (e) {
    console.error("[connexion-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
