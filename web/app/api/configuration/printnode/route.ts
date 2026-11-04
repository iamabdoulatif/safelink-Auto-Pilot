import { session } from "@/lib/session";
import {
  lireConfigPrintNode,
  enregistrerConfigPrintNode,
} from "@/lib/printnode";

// Configuration PrintNode de l'espace : cle API chiffree, imprimante
// cible, format papier, activation. Lecture masquee (« configuré » ou
// « absent »), jamais de cle en reponse ni dans les journaux.
// L'enregistrement teste reellement la cle (liste des imprimantes) :
// jamais d'impression automatique si non configure ET teste.
export async function GET() {
  const { tenantId, utilisateurId } = await session();
  try {
    const config = await lireConfigPrintNode({ tenantId, utilisateurId });
    return Response.json({ data: config });
  } catch (e) {
    console.error("[config-printnode]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const ctx = { tenantId, utilisateurId };
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const cle = typeof b["cle_api"] === "string" ? b["cle_api"] : "";
  const brutId = b["printer_id"];
  const printerId = typeof brutId === "number" ? brutId : NaN;
  const nom = typeof b["nom_imprimante"] === "string"
    ? b["nom_imprimante"] : "";
  const format = typeof b["format_papier"] === "string"
    ? b["format_papier"] : "A4";
  const actif = b["actif"] === undefined ? true : b["actif"] === true;
  try {
    const resultat = await enregistrerConfigPrintNode(
      ctx, cle.trim(), printerId, nom.trim(), format, actif);
    if ("erreur" in resultat) {
      const statut = resultat.erreur.startsWith("Imprimante")
        || resultat.erreur.startsWith("Clé") ? 502 : 400;
      return Response.json({ error: resultat.erreur }, { status: statut });
    }
    return Response.json({ data: resultat.config }, { status: 201 });
  } catch (e) {
    console.error("[config-printnode]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
