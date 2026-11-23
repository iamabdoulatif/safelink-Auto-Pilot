import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import { fichierRapport, FORMATS_RAPPORT } from "@/lib/rapport-fichiers";
import type { DonneesRapport, FormatRapport, VenteRapport } from "@/lib/rapport-fichiers";

// Fichier joint d'un rapport des ventes, fabriqué ici (le nœud Code de n8n
// ne sait pas envoyer de binaire) au format choisi par la zone, puis envoyé
// sur Telegram (chat de l'espace) ou WhatsApp (numéro de la zone).
// Appel signé par n8n, x-run-id = id du rapport. Aucun secret en réponse.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const id = (await params).id;
  if (controle.appel.runId !== id) return Response.json({ error: "rapportId incohérent." }, { status: 400 });
  const corps = controle.appel.corps;
  const canal = corps["canal"];
  if (canal !== "telegram" && canal !== "whatsapp") return Response.json({ error: "Canal invalide." }, { status: 400 });

  const { rows: [r] } = await db.query<{
    tenant_id: string; rapport_format: string | null;
    numero_admin: string | null; numero_gerant: string | null; numeros_vendeurs: unknown;
  }>(
    `SELECT e.tenant_id, z.rapport_format, z.numero_admin, z.numero_gerant, z.numeros_vendeurs
     FROM rapports_ventes_envois e
     LEFT JOIN zones_wifi_destinataires z
       ON z.router_connection_id = e.router_connection_id AND z.tenant_id = e.tenant_id
     WHERE e.rapport_id = $1`,
    [id],
  );
  if (!r) return Response.json({ error: "Rapport inconnu." }, { status: 404 });

  const d = (corps["donnees"] ?? {}) as Record<string, unknown>;
  const ventes: VenteRapport[] = (Array.isArray(d["ventes"]) ? d["ventes"] : []).slice(0, 50000).map((v: Record<string, unknown>) => ({
    ticket: String(v["ticket"] ?? ""), date: String(v["date"] ?? ""), heure: String(v["heure"] ?? ""),
    profil: String(v["profil"] ?? ""), prix: Number.isFinite(Number(v["prix"])) ? Number(v["prix"]) : 0, vendeur: String(v["vendeur"] ?? ""),
  }));
  const donnees: DonneesRapport = {
    titre: String(d["titre"] ?? "Rapport des ventes").slice(0, 120),
    zone: String(d["zone"] ?? "Zone Wi-Fi").slice(0, 120),
    periode: String(d["periode"] ?? "").slice(0, 120),
    debut: /^\d{4}-\d{2}-\d{2}$/.test(String(d["debut"])) ? String(d["debut"]) : "rapport",
    sousTitre: d["sousTitre"] ? String(d["sousTitre"]).slice(0, 80) : undefined,
    ventes,
    reste: d["reste"] && typeof d["reste"] === "object" ? (d["reste"] as Record<string, number>) : undefined,
  };
  const format: FormatRapport = FORMATS_RAPPORT.includes(r.rapport_format as FormatRapport) ? (r.rapport_format as FormatRapport) : "xlsx";
  const f = fichierRapport(format, donnees);
  const legende = String(corps["legende"] ?? "").slice(0, 1000);
  const form = new FormData();

  try {
    if (canal === "telegram") {
      const { rows: [tg] } = await db.query<{ chat_id: string | null; jeton_chiffre: string | null }>(
        "SELECT chat_id, jeton_chiffre FROM configurations_telegram WHERE tenant_id = $1", [r.tenant_id]);
      const jeton = tg?.jeton_chiffre ? dechiffrer(tg.jeton_chiffre) : process.env.TELEGRAM_BOT_TOKEN;
      if (!jeton || !tg?.chat_id) return Response.json({ error: "Telegram non configuré." }, { status: 428 });
      form.set("chat_id", tg.chat_id);
      if (legende) form.set("caption", legende);
      form.set("document", new Blob([new Uint8Array(f.contenu)], { type: f.mime }), f.nom);
      const rep = await fetch(`https://api.telegram.org/bot${jeton}/sendDocument`, { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
      const j = (await rep.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (!rep.ok || !j.ok) return Response.json({ error: "Telegram : " + (j.description ?? rep.status) }, { status: 502 });
    } else {
      const to = String(corps["to"] ?? "").trim();
      const autorises = [r.numero_admin, r.numero_gerant, ...(Array.isArray(r.numeros_vendeurs) ? r.numeros_vendeurs : [])]
        .map((n) => String(n ?? "").trim()).filter(Boolean);
      if (!autorises.includes(to)) return Response.json({ error: "Destinataire inconnu pour cette zone." }, { status: 400 });
      const { rows: [wa] } = await db.query<{ webhook_url: string | null }>(
        "SELECT webhook_url FROM configurations_whatsapp WHERE tenant_id = $1", [r.tenant_id]);
      if (!wa?.webhook_url) return Response.json({ error: "WhatsApp non configuré." }, { status: 428 });
      form.set("to", to);
      form.set("filename", f.nom);
      form.set("file", new Blob([new Uint8Array(f.contenu)], { type: f.mime }), f.nom);
      const rep = await fetch(wa.webhook_url, { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
      if (!rep.ok) return Response.json({ error: "WhatsApp : HTTP " + rep.status }, { status: 502 });
    }
  } catch (e) {
    console.error("[rapport-document]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Envoi du fichier impossible." }, { status: 502 });
  }
  return Response.json({ data: { fichier: f.nom, format } });
}
