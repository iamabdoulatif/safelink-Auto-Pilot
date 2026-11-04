import { session } from "@/lib/session";
import {
  lireInstallation,
  modifierInstallation,
  desactiverInstallation,
} from "@/lib/mikhmon-installations";
import type { EntreeInstallation } from "@/lib/mikhmon-installations";

function idDe(url: string): number | null {
  const m = /\/api\/connexions-mikhmon\/(\d+)/.exec(url);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) ? id : null;
}

// Lecture d'une installation de l'espace (erreur si autre espace).
export async function GET(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const id = idDe(req.url);
  if (id === null) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const installation = await lireInstallation(
      { tenantId, utilisateurId }, id);
    if (!installation) {
      return Response.json({ error: "Installation introuvable." },
        { status: 404 });
    }
    return Response.json({ data: installation });
  } catch (e) {
    console.error("[connexion-mikhmon]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

// Modification (mot de passe toujours re-saisi, jamais complete).
export async function PUT(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const ctx = { tenantId, utilisateurId };
  const id = idDe(req.url);
  if (id === null) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const b = (corps ?? {}) as Record<string, unknown>;
  const entree: EntreeInstallation = {
    nom: typeof b["nom"] === "string" ? b["nom"] : "",
    variante: typeof b["variante"] === "string" ? b["variante"] : "",
    hote: typeof b["hote"] === "string" ? b["hote"] : "",
    port: typeof b["port"] === "number" ? b["port"] : 8088,
    role: typeof b["role"] === "string" ? b["role"] : "",
    identifiant: typeof b["identifiant"] === "string" ? b["identifiant"] : "",
    motDePasse:
      typeof b["mot_de_passe"] === "string" ? b["mot_de_passe"] : "",
  };
  try {
    const modifiee = await modifierInstallation(ctx, id, entree);
    if ("erreur" in modifiee) {
      const statut = modifiee.erreur === "Installation introuvable."
        ? 404 : 400;
      return Response.json({ error: modifiee.erreur }, { status: statut });
    }
    return Response.json({ data: modifiee.installation });
  } catch (e) {
    console.error("[connexion-mikhmon]", e);
    // Clé de chiffrement absente : le dire clairement au lieu du
    // message générique (le mot de passe n'est jamais journalisé).
    if (e instanceof Error && e.message.includes("CHIFFREMENT_CLE")) {
      return Response.json(
        { error: "Chiffrement indisponible : clé serveur manquante (CHIFFREMENT_CLE)." },
        { status: 500 });
    }
    return Response.json({ error: "Modification impossible." },
      { status: 500 });
  }
}

// Desactivation (disabled=yes, jamais de suppression d'objet RouterOS).
export async function DELETE(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const id = idDe(req.url);
  if (id === null) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const ok = await desactiverInstallation(
      { tenantId, utilisateurId }, id);
    if (!ok) {
      return Response.json({ error: "Installation introuvable." },
        { status: 404 });
    }
    return Response.json({ data: { desactivee: true } });
  } catch (e) {
    console.error("[connexion-mikhmon]", e);
    return Response.json({ error: "Désactivation impossible." },
      { status: 500 });
  }
}
