import { db } from "@/lib/db";
import { session } from "@/lib/session";
import {
  listerInstallations,
  creerInstallation,
  testerInstallation,
} from "@/lib/mikhmon-installations";
import type { EntreeInstallation } from "@/lib/mikhmon-installations";

// Connexions Mikhmon de l'espace : liste masquee (jamais de mot de
// passe) et creation. Apres creation, le test serveur immediat
// renseigne le statut : en-ligne ou hors-ligne avec la date du test.
// URL proposee par defaut : hote 127.0.0.1, port 8088 (jamais codee en
// dur, toujours issue de la configuration). Les identifiants initiaux
// mikhmon / 1234 sont refuses avec avertissement.
export async function GET() {
  const { tenantId, utilisateurId } = await session();
  try {
    const installations = await listerInstallations(
      { tenantId, utilisateurId });
    return Response.json({ data: installations });
  } catch (e) {
    console.error("[connexions-mikhmon]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { tenantId, utilisateurId } = await session();
  const ctx = { tenantId, utilisateurId };
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
    const creee = await creerInstallation(ctx, entree);
    if ("erreur" in creee) {
      return Response.json({ error: creee.erreur }, { status: 400 });
    }
    // Test serveur immediat : jamais depuis le navigateur.
    const test = await testerInstallation(ctx, creee.installation.id);
    if ("erreur" in test) {
      return Response.json(
        { data: { ...creee.installation, test: test.erreur } },
        { status: 201 });
    }
    const { rows } = await db.query(
      `SELECT statut_connexion, dernier_test_le FROM configurations_routeurs
       WHERE id=$1`,
      [creee.installation.id]);
    const lignes = rows as {
      statut_connexion: string; dernier_test_le: string | null;
    }[];
    return Response.json({
      data: {
        ...creee.installation,
        statutConnexion: lignes[0]?.statut_connexion ?? "en-ligne",
        dernierTestLe: lignes[0]?.dernier_test_le ?? null,
      },
    }, { status: 201 });
  } catch (e) {
    console.error("[connexions-mikhmon]", e);
    // Clé de chiffrement absente : le dire clairement au lieu du
    // message générique (le mot de passe n'est jamais journalisé).
    if (e instanceof Error && e.message.includes("CHIFFREMENT_CLE")) {
      return Response.json(
        { error: "Chiffrement indisponible : clé serveur manquante (CHIFFREMENT_CLE)." },
        { status: 500 });
    }
    return Response.json({ error: "Enregistrement impossible." },
      { status: 500 });
  }
}
