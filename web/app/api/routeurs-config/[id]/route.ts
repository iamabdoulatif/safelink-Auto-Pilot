import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  lireConnexionRouteur,
  enregistrerConnexionRouteur,
} from "@/lib/connexions-routeur";
import type { EntreeRouteur } from "@/lib/connexions-routeur";

// Section RouterOS d'une configuration : lecture masquee et ecriture
// chiffree. Les identifiants RouterOS ne sont jamais confondus avec
// Mikhmon : diagnostic = compte lecture seule, ecritures = compte de
// correction uniquement, apres validation humaine.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId, utilisateurId } = await session();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const connexion = await lireConnexionRouteur(
      { tenantId, utilisateurId }, id);
    if (!connexion) {
      return Response.json({ error: "Configuration introuvable." },
        { status: 404 });
    }
    return Response.json({ data: connexion });
  } catch (e) {
    console.error("[routeur-config]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const ctx = { tenantId, utilisateurId };
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const entree: EntreeRouteur = {
    adresseRouterOS: typeof b["adresse_routeros"] === "string"
      ? b["adresse_routeros"] : "",
    utilisateurLecture: typeof b["utilisateur_lecture"] === "string"
      ? b["utilisateur_lecture"] : "",
    motDePasseLecture: typeof b["mot_de_passe_lecture"] === "string"
      ? b["mot_de_passe_lecture"] : "",
    utilisateurCorrection: typeof b["utilisateur_correction"] === "string"
      ? b["utilisateur_correction"] : "",
    motDePasseCorrection: typeof b["mot_de_passe_correction"] === "string"
      ? b["mot_de_passe_correction"] : "",
    serveurHotspot: typeof b["serveur_hotspot"] === "string"
      ? b["serveur_hotspot"] : "",
  };
  try {
    const resultat = await enregistrerConnexionRouteur(ctx, id, entree);
    if ("erreur" in resultat) {
      const statut = resultat.erreur === "Configuration introuvable."
        ? 404 : 400;
      return Response.json({ error: resultat.erreur }, { status: statut });
    }
    return Response.json({ data: resultat.connexion });
  } catch (e) {
    console.error("[routeur-config]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
