import { timingSafeEqual } from "node:crypto";
import { releverParc } from "@/lib/diagnostic/releve-parc";

// Relevé périodique de tout le parc actif (cron système, toutes les 15 min) :
// seuls les routeurs sans relevé depuis 10 min sont interrogés.
// Protégé par CRON_SECRET (en-tête x-cron-secret), comme /api/tickets/auto.
const CRON = process.env.CRON_SECRET ?? "";

function autorise(req: Request) {
  if (!CRON) return false;
  const recu = Buffer.from(req.headers.get("x-cron-secret") ?? "");
  const attendu = Buffer.from(CRON);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

export async function POST(req: Request) {
  if (!autorise(req)) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const bilan = await releverParc({ plusVieuxQueMin: 10 });
  return Response.json({ data: { releves: bilan.length, bilan } });
}
