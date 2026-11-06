import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  enregistrerZoneWifi,
  listerZonesWifi,
  validerZoneWifi,
} from "@/lib/zones-wifi";

// Zones Wi-Fi de l'espace : une fiche par routeur (localisation,
// commune, numéros WhatsApp admin / gérant / vendeurs). Ces numéros
// reçoivent le PDF des tickets à chaque génération sur la zone.
// Lecture : tout membre. Écriture : admins de l'espace uniquement.
// Réponses { data } ou { error } uniquement.
export async function GET() {
  const ctx = await session();
  try {
    const zones = await listerZonesWifi(ctx);
    return Response.json({ data: { zones } });
  } catch (e) {
    console.error("[zones-wifi]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Seul un admin de l'espace peut renseigner les zones." },
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
  const routerConnectionId = b["routerConnectionId"];
  if (!Number.isInteger(routerConnectionId) || (routerConnectionId as number) <= 0) {
    return Response.json(
      { error: "routerConnectionId doit être un entier." },
      { status: 400 },
    );
  }
  const valide = validerZoneWifi(b);
  if ("erreur" in valide) {
    return Response.json({ error: valide.erreur }, { status: 400 });
  }
  try {
    const resultat = await enregistrerZoneWifi(
      ctx, routerConnectionId as number, valide.zone);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 404 });
    }
    return Response.json({ data: { zone: resultat.zone } }, { status: 201 });
  } catch (e) {
    console.error("[zones-wifi]", e);
    return Response.json({ error: "Enregistrement impossible." }, { status: 500 });
  }
}
