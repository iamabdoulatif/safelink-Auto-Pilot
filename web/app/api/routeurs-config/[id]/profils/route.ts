import { session } from "@/lib/session";
import {
  listerProfilsHotspot,
  lireMotDePasseLecture,
} from "@/lib/connexions-routeur";

// Profils Hotspot disponibles (/ip/hotspot/profile, lecture seule).
// Le mot de passe de lecture est dechiffre cote serveur uniquement.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId, utilisateurId } = await session();
  const ctx = { tenantId, utilisateurId };
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const motDePasse = await lireMotDePasseLecture(ctx, id);
    if (!motDePasse) {
      return Response.json(
        { error: "Mot de passe de lecture manquant : enregistrez la section « Mes routeurs »." },
        { status: 409 });
    }
    const profils = await listerProfilsHotspot(ctx, id, motDePasse);
    if ("erreur" in profils) {
      return Response.json({ error: profils.erreur }, { status: 502 });
    }
    return Response.json({ data: profils.profils });
  } catch (e) {
    console.error("[routeur-profils]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
