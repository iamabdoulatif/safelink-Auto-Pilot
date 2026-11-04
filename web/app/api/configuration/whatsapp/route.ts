import { session } from "@/lib/session";
import {
  lireConfigWhatsApp,
  enregistrerConfigWhatsApp,
  marquerTestWhatsApp,
  testerWebhookWhatsApp,
} from "@/lib/whatsapp";

// Configuration WhatsApp de l'espace : URL de l'adaptateur, destinataire
// et secret eventuel (chiffre). Lecture masquee, jamais de secret en
// reponse ni dans les journaux. Jamais de mot de passe dans une URL.
export async function GET() {
  const { tenantId, utilisateurId } = await session();
  try {
    const config = await lireConfigWhatsApp({ tenantId, utilisateurId });
    return Response.json({ data: config });
  } catch (e) {
    console.error("[config-whatsapp]", e);
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
  const webhookUrl = typeof b["webhook_url"] === "string"
    ? b["webhook_url"] : "";
  const secret = typeof b["secret"] === "string" ? b["secret"] : "";
  const destinataire = typeof b["destinataire"] === "string"
    ? b["destinataire"] : "";
  const actif = b["actif"] === undefined ? true : b["actif"] === true;
  try {
    const resultat = await enregistrerConfigWhatsApp(
      ctx, webhookUrl, secret, destinataire, actif);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    // Test serveur immediat (joignabilite, sans secret).
    const test = await testerWebhookWhatsApp(webhookUrl);
    await marquerTestWhatsApp(ctx, !("erreur" in test));
    const relue = await lireConfigWhatsApp(ctx);
    if (!("erreur" in test)) {
      return Response.json({ data: relue }, { status: 201 });
    }
    return Response.json(
      { data: { ...relue, test: test.erreur } }, { status: 201 });
  } catch (e) {
    console.error("[config-whatsapp]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
