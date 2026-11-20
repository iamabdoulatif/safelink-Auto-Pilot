import { db } from "@/lib/db";
import { verifierAppelInterne } from "@/lib/n8n-interne";
import { dechiffrer } from "@/lib/chiffrement-serveur";

// Configuration signée d'UN relevé de suivi : identifiants RouterOS
// en lecture seule du routeur d'une zone. Même règle que la lecture
// de configuration d'un rapport : secret déchiffré uniquement
// pendant l'exécution autorisée, jamais journalisé.
export async function POST(req: Request) {
  const controle = await verifierAppelInterne(req, { exigerRunId: true });
  if ("reponse" in controle) return controle.reponse;
  const tenantId = controle.appel.corps["tenantId"];
  const routerConnectionId = controle.appel.corps["routerConnectionId"];
  if (typeof tenantId !== "string" || !tenantId
    || !Number.isInteger(routerConnectionId)) {
    return Response.json({ error: "Zone de suivi invalide." },
      { status: 400 });
  }
  const { rows } = await db.query(
    `SELECT r.variante_mikhmon, r.adresse_routeros,
        r.utilisateur_lecture, r.utilisateur_correction,
        r.mot_de_passe_lecture_chiffre, r.mot_de_passe_correction_chiffre
     FROM configurations_routeurs r
     WHERE r.id = $1 AND r.tenant_id = $2`,
    [routerConnectionId, tenantId],
  );
  const lignes = rows as Record<string, unknown>[];
  if (lignes.length === 0) {
    return Response.json({ error: "Routeur inconnu pour ce suivi." },
      { status: 404 });
  }
  const l = lignes[0];
  let motDePasse: string | null = null;
  let utilisateur = String(l["utilisateur_lecture"] ?? "");
  try {
    if (l["mot_de_passe_lecture_chiffre"]) {
      motDePasse = dechiffrer(l["mot_de_passe_lecture_chiffre"] as string);
    }
    if (!motDePasse && l["mot_de_passe_correction_chiffre"]) {
      motDePasse = dechiffrer(l["mot_de_passe_correction_chiffre"] as string);
      utilisateur = String(l["utilisateur_correction"] ?? "");
    }
  } catch {
    return Response.json({ error: "Secrets illisibles." }, { status: 500 });
  }
  if (!motDePasse) {
    return Response.json({ error: "Mot de passe RouterOS manquant." },
      { status: 428 });
  }
  return Response.json({
    data: {
      tenantId,
      routerConnectionId,
      routeur: {
        variante: l["variante_mikhmon"] ?? "v3",
        adresse: String(l["adresse_routeros"] ?? "").replace(/\/$/, ""),
        utilisateur,
        motDePasse,
      },
    },
  });
}
