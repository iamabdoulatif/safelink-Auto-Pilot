import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import {
  lireInstallation,
  modifierInstallation,
  supprimerInstallation,
} from "@/lib/mikhmon-installations";
import type { EntreeInstallation } from "@/lib/mikhmon-installations";

// Detail, modification et suppression (apres confirmation UI) d'une
// installation Mikhmon de l'espace. La suppression ne touche que la
// ligne locale : jamais d'objet RouterOS.
type ContexteRoute = { params: Promise<{ id: string }> };

function identifiant(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function entreeDepuis(corps: unknown): EntreeInstallation {
  const b = (corps ?? {}) as Record<string, unknown>;
  const portBrut = b["port"];
  return {
    nom: typeof b["nom"] === "string" ? b["nom"] : "",
    variante: typeof b["variante"] === "string" ? b["variante"] : "",
    hote: typeof b["hote"] === "string" ? b["hote"] : "",
    port: typeof portBrut === "number" ? portBrut : 0,
    role: typeof b["role"] === "string" ? b["role"] : "",
    identifiant: typeof b["identifiant"] === "string" ? b["identifiant"] : "",
    motDePasse: typeof b["motDePasse"] === "string" ? b["motDePasse"] : "",
  };
}

export async function GET(_req: Request, { params }: ContexteRoute) {
  const ctx = await session();
  const id = identifiant((await params).id);
  if (id === null) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const installation = await lireInstallation(ctx, id);
    if (!installation) {
      return Response.json({ error: "Installation introuvable." },
        { status: 404 });
    }
    return Response.json({ data: { installation } });
  } catch (e) {
    console.error("[installation-mikhmon]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: ContexteRoute) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const id = identifiant((await params).id);
  if (id === null) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  try {
    const resultat = await modifierInstallation(ctx, id, entreeDepuis(corps));
    if ("erreur" in resultat) {
      const absent = resultat.erreur.includes("introuvable");
      return Response.json(
        { error: resultat.erreur },
        { status: absent ? 404 : 400 },
      );
    }
    return Response.json({ data: { installation: resultat.installation } });
  } catch (e) {
    console.error("[installation-mikhmon]", e);
    return Response.json({ error: "Modification impossible." },
      { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: ContexteRoute) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const id = identifiant((await params).id);
  if (id === null) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const supprime = await supprimerInstallation(ctx, id);
    if (!supprime) {
      return Response.json({ error: "Installation introuvable." },
        { status: 404 });
    }
    return Response.json({ data: { supprime: true } });
  } catch (e) {
    console.error("[installation-mikhmon]", e);
    return Response.json({ error: "Suppression impossible." },
      { status: 500 });
  }
}
