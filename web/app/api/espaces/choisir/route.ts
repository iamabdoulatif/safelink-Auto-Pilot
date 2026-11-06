import { listerEspacesDe } from "@/lib/membres";
import { reponseAuthentification, session } from "@/lib/session";
import { attributCookieSession, signerSession } from "@/lib/session-cookie";

// POST : basculer vers un autre espace auquel l'utilisateur
// appartient. Le cookie de session est réémis pour ce tenant ; le
// rôle est toujours recalculé depuis la base à chaque action.
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
  try {
    const ctx = await session();
    const cible = typeof b["tenantId"] === "string" ? b["tenantId"] : "";
    const espaces = await listerEspacesDe(ctx.utilisateurId);
    if (!espaces.some((e) => e.tenantId === cible)) {
      return Response.json(
        { error: "Vous n'appartenez pas à cet espace." },
        { status: 403 },
      );
    }
    const cookie = signerSession(secret, {
      utilisateurId: ctx.utilisateurId,
      tenantId: cible,
    });
    return Response.json(
      { data: { ok: true } },
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
    const refus = reponseAuthentification(e);
    if (refus) return refus;
    console.error("[espaces] Bascule impossible.");
    return Response.json({ error: "Bascule impossible." }, { status: 500 });
  }
}
