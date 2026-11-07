import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  apercuSuppression,
  appliquerSuppression,
} from "@/lib/suppression-profil";

// Suppression d'un profil et de ses tickets, en deux temps :
// POST (aperçu) = plan exact et compteurs, lecture seule, rien
// n'est écrit. DELETE (application) = seulement avec le nom du
// profil retapé à l'identique, admins uniquement. Côté RouterOS,
// le profil et ses tickets sont désactivés (jamais supprimés) :
// l'effet est le même pour les clients, et c'est réversible à la
// main. La règle SaaS est supprimée après vérification.
function entierPositif(v: unknown): number {
  return Number.isInteger(v) && (v as number) > 0 ? (v as number) : NaN;
}

export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Seul un admin de l'espace peut supprimer un profil." },
      { status: 403 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const regleId = entierPositif((corps as Record<string, unknown>)?.["regleId"]);
  if (!Number.isInteger(regleId)) {
    return Response.json({ error: "regleId doit être un entier." },
      { status: 400 });
  }
  try {
    const resultat = await apercuSuppression(ctx, regleId);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 400 });
    }
    return Response.json({ data: resultat.apercu });
  } catch {
    return Response.json({ error: "Aperçu impossible." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Seul un admin de l'espace peut supprimer un profil." },
      { status: 403 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const regleId = entierPositif(b["regleId"]);
  if (!Number.isInteger(regleId)) {
    return Response.json({ error: "regleId doit être un entier." },
      { status: 400 });
  }
  try {
    const apercuResultat = await apercuSuppression(ctx, regleId);
    if ("erreur" in apercuResultat) {
      return Response.json({ error: apercuResultat.erreur }, { status: 400 });
    }
    if (b["confirmation"] !== apercuResultat.apercu.profil) {
      return Response.json({
        error: "Confirmation incorrecte : retapez le nom exact du profil.",
      }, { status: 400 });
    }
    const resultat = await appliquerSuppression(ctx, regleId);
    if ("erreur" in resultat) {
      return Response.json({ error: resultat.erreur }, { status: 502 });
    }
    return Response.json({ data: resultat });
  } catch {
    return Response.json({ error: "Suppression impossible." }, { status: 500 });
  }
}
