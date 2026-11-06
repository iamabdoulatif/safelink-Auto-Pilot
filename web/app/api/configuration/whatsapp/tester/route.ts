import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  lireConfigWhatsApp,
  marquerTestWhatsApp,
  testerWebhookWhatsApp,
} from "@/lib/whatsapp";

// Teste la joignabilite du webhook COTE SERVEUR (GET, sans secret).
export async function POST() {
  const { tenantId, utilisateurId } = await session();
  if (!(await peutAgir({ tenantId, utilisateurId }, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const ctx = { tenantId, utilisateurId };
  try {
    const config = await lireConfigWhatsApp(ctx);
    if (!config) {
      return Response.json({ error: "WhatsApp non configuré." },
        { status: 404 });
    }
    const test = await testerWebhookWhatsApp(config.webhookUrl);
    await marquerTestWhatsApp(ctx, !("erreur" in test));
    if ("erreur" in test) {
      return Response.json({ error: test.erreur }, { status: 502 });
    }
    return Response.json({ data: { joignable: true } });
  } catch (e) {
    console.error("[config-whatsapp-tester]", e);
    return Response.json({ error: "Test impossible." }, { status: 500 });
  }
}
