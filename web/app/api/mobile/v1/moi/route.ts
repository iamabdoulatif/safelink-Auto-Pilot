import { db } from "@/lib/db";
import { reponseAuthentification, session } from "@/lib/session";
import { roleDansEspace } from "@/lib/membres";

// Profil du compte connecté (mobile) : identité, espace et rôle.
export async function GET() {
  try {
    const ctx = await session();
    const { rows } = await db.query(
      `SELECT nom, prenom, pays, numero FROM utilisateurs WHERE courriel = $1`,
      [ctx.utilisateurId],
    );
    const u = (rows as Record<string, unknown>[])[0] ?? {};
    const role = await roleDansEspace(ctx.tenantId, ctx.utilisateurId);
    return Response.json({
      data: {
        courriel: ctx.utilisateurId,
        tenantId: ctx.tenantId,
        nom: u["nom"] ?? "",
        prenom: u["prenom"] ?? "",
        pays: u["pays"] ?? "",
        numero: u["numero"] ?? "",
        role,
      },
    });
  } catch (e) {
    return reponseAuthentification(e)
      ?? Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
