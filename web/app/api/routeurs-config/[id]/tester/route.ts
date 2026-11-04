import { session } from "@/lib/session";
import {
  testerConnexionRouteur,
  lireMotDePasseLecture,
} from "@/lib/connexions-routeur";

// Teste la connexion RouterOS COTE SERVEUR avec le compte de lecture
// seule. Le mot de passe vient du corps (jamais stocke) ou, a defaut,
// du secret chiffre de la configuration. Ne journalise aucun secret.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId, utilisateurId } = await session();
  const ctx = { tenantId, utilisateurId };
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    corps = {};
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const fourni = typeof b["mot_de_passe_lecture"] === "string"
    ? b["mot_de_passe_lecture"]
    : "";
  try {
    const motDePasse = fourni || await lireMotDePasseLecture(ctx, id);
    if (!motDePasse) {
      return Response.json(
        { error: "Mot de passe de lecture manquant : saisissez-le ou enregistrez la section." },
        { status: 400 });
    }
    const test = await testerConnexionRouteur(ctx, id, motDePasse);
    if ("erreur" in test) {
      return Response.json({ error: test.erreur }, { status: 502 });
    }
    return Response.json({ data: { en_ligne: true, version: test.version } });
  } catch (e) {
    console.error("[routeur-config-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
