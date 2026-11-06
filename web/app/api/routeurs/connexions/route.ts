import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  enregistrerConnexionRouteur,
  lireConnexionRouteur,
} from "@/lib/connexions-routeur";
import type { EntreeRouteur } from "@/lib/connexions-routeur";

// Connexion RouterOS d'une configuration : lecture masquee (le mot de
// passe de correction n'est jamais renvoye) et enregistrement chiffre.
// Le mot de passe de lecture ne sert qu'au test : il n'est pas stocke.
export async function GET(req: Request) {
  const ctx = await session();
  const brut = new URL(req.url).searchParams.get("configurationId");
  const configurationId = Number(brut);
  if (!Number.isInteger(configurationId) || configurationId <= 0) {
    return Response.json({ error: "configurationId doit être un entier." },
      { status: 400 });
  }
  try {
    const connexion = await lireConnexionRouteur(ctx, configurationId);
    if (!connexion) {
      return Response.json({ error: "Configuration introuvable." },
        { status: 404 });
    }
    return Response.json({ data: { connexion } });
  } catch (e) {
    console.error("[connexion-routeros]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
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
  if (!Number.isInteger(idBrut) || (idBrut as number) <= 0) {
    return Response.json({ error: "configurationId doit être un entier." },
      { status: 400 });
  }
  const entree: EntreeRouteur = {
    adresseRouterOS:
      typeof b["adresseRouterOS"] === "string" ? b["adresseRouterOS"] : "",
    utilisateurLecture:
      typeof b["utilisateurLecture"] === "string"
        ? b["utilisateurLecture"]
        : "",
    motDePasseLecture:
      typeof b["motDePasseLecture"] === "string" ? b["motDePasseLecture"] : "",
    utilisateurCorrection:
      typeof b["utilisateurCorrection"] === "string"
        ? b["utilisateurCorrection"]
        : "",
    motDePasseCorrection:
      typeof b["motDePasseCorrection"] === "string"
        ? b["motDePasseCorrection"]
        : "",
    serveurHotspot:
      typeof b["serveurHotspot"] === "string" ? b["serveurHotspot"] : "",
  };
  try {
    const resultat = await enregistrerConnexionRouteur(
      ctx, idBrut as number, entree);
    if ("erreur" in resultat) {
      const absent = resultat.erreur.includes("introuvable");
      return Response.json(
        { error: resultat.erreur },
        { status: absent ? 404 : 400 },
      );
    }
    return Response.json({ data: { connexion: resultat.connexion } });
  } catch (e) {
    console.error("[connexion-routeros]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
