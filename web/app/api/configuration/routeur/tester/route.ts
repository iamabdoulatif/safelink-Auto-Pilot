import {
  extraireChamps,
  testerConnexions,
} from "@/lib/configuration-routeur";

// « Tester la connexion » : memes controles qu'« Enregistrer »
// (forme, refus du mot de passe initial, preuves de vie), sans
// rien ecrire en base. Aucun secret n'est journalise ni renvoye.
export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const resultat = extraireChamps((corps ?? {}) as Record<string, unknown>);
  if ("erreur" in resultat) {
    return Response.json({ error: resultat.erreur }, { status: 400 });
  }
  const echec = await testerConnexions(resultat.champs);
  if (echec) {
    return Response.json({ error: echec }, { status: 502 });
  }
  return Response.json({
    data: { routeur_ok: true, mikhmon_ok: true },
  });
}
