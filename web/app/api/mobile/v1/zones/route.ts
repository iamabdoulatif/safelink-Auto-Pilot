import { reponseAuthentification, session } from "@/lib/session";
import { listerZonesWifi } from "@/lib/zones-wifi";

// Zones Wi-Fi de l'espace avec destinataires et géolocalisation.
export async function GET() {
  try {
    const ctx = await session();
    const zones = await listerZonesWifi(ctx);
    return Response.json({ data: { zones } });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
