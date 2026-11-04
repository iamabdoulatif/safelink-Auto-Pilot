import { db } from "@/lib/db";
import { verifierBrut } from "@/lib/signature";

// Socle des routes internes SafeLink <-> n8n. Chaque appel entrant porte :
// x-signature (HMAC-SHA256 du corps BRUT avec N8N_CALLBACK_SECRET),
// x-timestamp (millisecondes epoch, fenetre de 5 minutes),
// x-run-id (identifiant de la rafale ou du job, anti-confusion).
// La signature est memorisee dans internal_nonces : rejouer la meme
// requete est refuse. Aucun secret n'est journalise ici, jamais.
const FENETRE_MS = 5 * 60 * 1000;

export type AppelInterne = {
  corps: Record<string, unknown>;
  runId: string;
};

function secretPartage(): string {
  return process.env.N8N_CALLBACK_SECRET ?? "";
}

function horodatageValide(brut: string | null): boolean {
  if (!brut) return false;
  const n = Number(brut);
  if (!Number.isInteger(n) || n <= 0) return false;
  return Math.abs(Date.now() - n) <= FENETRE_MS;
}

// Rejette une signature deja vue, memorise les nouvelles. Vrai = fraiche.
async function signatureFraiche(signature: string): Promise<boolean> {
  try {
    await db.query(
      `DELETE FROM internal_nonces WHERE recu_le < now() - interval '10 minutes'`,
    );
    const { rowCount } = await db.query(
      `INSERT INTO internal_nonces (cle) VALUES ($1)
       ON CONFLICT (cle) DO NOTHING`,
      [signature],
    );
    return (rowCount ?? 0) === 1;
  } catch {
    return false;
  }
}

// Verifie un appel interne. Rend l'appel ou une reponse { error } prete.
export async function verifierAppelInterne(
  req: Request,
  options: { exigerRunId: boolean },
): Promise<{ appel: AppelInterne } | { reponse: Response }> {
  const secret = secretPartage();
  if (!secret) {
    return {
      reponse: Response.json(
        { error: "Retours n8n non configurés." },
        { status: 503 },
      ),
    };
  }
  const brut = await req.text();
  const signature = req.headers.get("x-signature") ?? "";
  const horodatage = req.headers.get("x-timestamp");
  const runId = (req.headers.get("x-run-id") ?? "").trim();
  if (!verifierBrut(secret, brut, signature)) {
    return {
      reponse: Response.json({ error: "Signature invalide." }, { status: 401 }),
    };
  }
  if (!horodatageValide(horodatage)) {
    return {
      reponse: Response.json(
        { error: "Horodatage absent ou expiré." },
        { status: 401 },
      ),
    };
  }
  if (options.exigerRunId && (!runId || runId.length > 128)) {
    return {
      reponse: Response.json(
        { error: "En-tête x-run-id obligatoire." },
        { status: 400 },
      ),
    };
  }
  if (!(await signatureFraiche(signature))) {
    return {
      reponse: Response.json(
        { error: "Requête déjà traitée." },
        { status: 409 },
      ),
    };
  }
  let corps: unknown;
  try {
    corps = brut ? (JSON.parse(brut) as unknown) : {};
  } catch {
    return {
      reponse: Response.json(
        { error: "Corps JSON invalide." },
        { status: 400 },
      ),
    };
  }
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) {
    return {
      reponse: Response.json({ error: "Corps JSON invalide." }, { status: 400 }),
    };
  }
  return { appel: { corps: corps as Record<string, unknown>, runId } };
}
