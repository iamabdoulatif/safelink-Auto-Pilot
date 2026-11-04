import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Webhook entrant PrintNode : PrintNode appelle cette URL a chaque
// changement d'etat d'impression (« print job state »). Le secret
// partage arrive dans l'en-tete x-printnode-webhook-secret, compare
// en temps constant (meme modele que le webhook Telegram). Anti-doublon
// sur l'uid de chaque evenement (PrintNode reessaie puis abandonne).
// Succes exige par PrintNode : HTTP 2xx ET en-tete
// X-PrintNode-Webhook-Status: OK, sinon l'evenement est refile.
function empreinte(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function secretsEgaux(attendu: string, recu: string): boolean {
  if (!attendu || !recu) return false;
  const a = empreinte(attendu);
  const b = empreinte(recu);
  return a.length === b.length && timingSafeEqual(a, b);
}

function reponseOk(donnees: Record<string, unknown>): Response {
  return Response.json(
    { data: donnees },
    { headers: { "X-PrintNode-Webhook-Status": "OK" } },
  );
}

type Evenement = {
  type?: unknown;
  createdAt?: unknown;
  data?: { uid?: unknown; printJobId?: unknown };
};

export async function POST(req: Request) {
  const recu = req.headers.get("x-printnode-webhook-secret") ?? "";
  if (!recu) {
    return Response.json({ error: "Secret absent." }, { status: 401 });
  }
  const brut = await req.text();
  let evenements: Evenement[];
  try {
    const corps: unknown = JSON.parse(brut);
    if (!Array.isArray(corps)) throw new Error("pas un tableau");
    evenements = corps as Evenement[];
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  try {
    // Retrouve l'espace par comparaison du secret (un par utilisateur).
    const { rows } = await db.query(
      `SELECT tenant_id, secret_webhook_chiffre
       FROM configurations_printnode
       WHERE secret_webhook_chiffre IS NOT NULL`,
    );
    const lignes = rows as {
      tenant_id: string;
      secret_webhook_chiffre: string;
    }[];
    let tenantId: string | null = null;
    const { dechiffrer } = await import("@/lib/chiffrement");
    for (const l of lignes) {
      let clair = "";
      try {
        clair = dechiffrer(l.secret_webhook_chiffre);
      } catch {
        continue;
      }
      if (secretsEgaux(clair, recu)) {
        tenantId = l.tenant_id;
        break;
      }
    }
    if (!tenantId) {
      return Response.json({ error: "Secret invalide." }, { status: 401 });
    }
    // Anti-doublon : un uid deja recu est accuse sans retraitement.
    // Le lien lot <-> printJobId viendra a l'etape suivante.
    let traites = 0;
    for (const ev of evenements) {
      if (ev.type !== "print job state") continue;
      const uid =
        typeof ev.data?.uid === "string" && ev.data.uid
          ? ev.data.uid
          : null;
      if (!uid) continue;
      const { rowCount } = await db.query(
        `INSERT INTO webhooks_recus (source, cle_unique)
         VALUES ('printnode', $1)
         ON CONFLICT (source, cle_unique) DO NOTHING`,
        ["pn-" + tenantId + "-" + uid],
      );
      if ((rowCount ?? 0) > 0) traites++;
    }
    return reponseOk({ recu: true, traites });
  } catch (e) {
    console.error("[printnode-webhook]", e);
    return Response.json({ error: "Echec du traitement." }, { status: 500 });
  }
}
