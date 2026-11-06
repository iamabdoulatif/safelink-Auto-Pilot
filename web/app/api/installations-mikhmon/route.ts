import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  creerInstallation,
  listerInstallations,
} from "@/lib/mikhmon-installations";
import type { EntreeInstallation } from "@/lib/mikhmon-installations";

// Installations Mikhmon de l'espace : liste masquee (jamais de secret)
// et creation (mot de passe chiffre, testable ensuite cote serveur).
export async function GET() {
  const ctx = await session();
  try {
    const installations = await listerInstallations(ctx);
    return Response.json({ data: { installations } });
  } catch (e) {
    console.error("[installations-mikhmon]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const portBrut = b["port"];
  const entree: EntreeInstallation = {
    nom: typeof b["nom"] === "string" ? b["nom"] : "",
    variante: typeof b["variante"] === "string" ? b["variante"] : "",
    hote: typeof b["hote"] === "string" ? b["hote"] : "",
    port: typeof portBrut === "number" ? portBrut : 0,
    role: typeof b["role"] === "string" ? b["role"] : "",
    identifiant: typeof b["identifiant"] === "string" ? b["identifiant"] : "",
    motDePasse: typeof b["motDePasse"] === "string" ? b["motDePasse"] : "",
  };
  try {
    const resultat = await creerInstallation(ctx, entree);
    if ("erreur" in resultat) {
      const conflit = resultat.erreur.includes("existe déjà");
      return Response.json(
        { error: resultat.erreur },
        { status: conflit ? 409 : 400 },
      );
    }
    return Response.json(
      { data: { installation: resultat.installation } },
      { status: 201 },
    );
  } catch (e) {
    console.error("[installations-mikhmon]", e);
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
