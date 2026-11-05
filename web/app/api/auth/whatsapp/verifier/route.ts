import { attributCookieSession } from "@/lib/session-cookie";
import { cookiePourCompte } from "@/lib/auth";
import { verifierCodeWhatsApp } from "@/lib/verification-whatsapp";
import { normaliserCourriel } from "@/lib/auth";
import { db } from "@/lib/db";

// Validation du code WhatsApp : si le code est bon, le numéro passe
// vérifié, la session s'ouvre, et le client peut partir vers le groupe
// communautaire (lien renvoyé) ou le tableau de bord.
export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET ?? "";
  if (!secret) {
    return Response.json({ error: "Sessions non configurées." }, { status: 503 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const courriel = normaliserCourriel(b["courriel"]);
  if (!courriel) return Response.json({ error: "Courriel invalide." }, { status: 400 });
  try {
    const resultat = await verifierCodeWhatsApp(courriel, b["code"]);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    const { rows } = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM utilisateurs WHERE courriel = $1`,
      [courriel],
    );
    if (rows.length === 0) {
      return Response.json({ error: "Compte introuvable." }, { status: 404 });
    }
    const cookie = cookiePourCompte(secret, {
      tenantId: rows[0].tenant_id,
      utilisateurId: courriel,
    });
    const lienCommunaute = process.env.LIEN_COMMUNAUTE?.trim() || null;
    return Response.json(
      { data: { tenantId: rows[0].tenant_id, utilisateurId: courriel, lienCommunaute } },
      {
        headers: {
          "Set-Cookie": attributCookieSession(
            cookie,
            process.env.NODE_ENV === "production",
          ),
        },
      },
    );
  } catch (e) {
    console.error("[auth-whatsapp-verifier]", e);
    return Response.json({ error: "Validation impossible." }, { status: 500 });
  }
}
