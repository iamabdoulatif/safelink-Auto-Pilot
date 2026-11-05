import {
  enregistrerParametresPlateforme,
  lireParametresPlateforme,
} from "@/lib/parametres-plateforme";
import { session, ErreurAuthentification } from "@/lib/session";
import { estSuperAdmin } from "@/lib/superadmin";

// Paramètres de la plateforme (lien du groupe, webhook du code
// WhatsApp) : lecture et écriture réservées au superadmin. Le secret
// n'est jamais renvoyé, seulement son état de configuration.
async function exigerSuperAdmin(): Promise<boolean> {
  try {
    const { utilisateurId } = await session();
    return estSuperAdmin(utilisateurId);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await exigerSuperAdmin())) {
    return Response.json({ error: "Accès réservé au superadmin." }, { status: 403 });
  }
  try {
    return Response.json({ data: await lireParametresPlateforme() });
  } catch (e) {
    if (e instanceof ErreurAuthentification) {
      return Response.json({ error: e.message }, { status: 401 });
    }
    console.error("[admin-parametres]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await exigerSuperAdmin())) {
    return Response.json({ error: "Accès réservé au superadmin." }, { status: 403 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  try {
    const resultat = await enregistrerParametresPlateforme({
      lienCommunaute: b["lienCommunaute"],
      webhookOtpUrl: b["webhookOtpUrl"],
      secretOtp: b["secretOtp"],
    });
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    return Response.json({ data: resultat.parametres });
  } catch (e) {
    console.error("[admin-parametres]", e);
    return Response.json({ error: "Enregistrement impossible." }, { status: 500 });
  }
}
