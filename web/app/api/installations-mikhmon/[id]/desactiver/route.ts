import { session } from "@/lib/session";
import { peutAgir } from "@/lib/membres";
import { desactiverInstallation } from "@/lib/mikhmon-installations";

// Desactive une installation (disabled=yes cote logique) : elle reste en
// base mais n'est plus proposee. Jamais de suppression d'objet RouterOS.
export async function POST(_req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const ctx = await session();
  if (!(await peutAgir(ctx, "admin"))) {
    return Response.json(
      { error: "Votre rôle dans cet espace ne permet pas cette action." },
      { status: 403 },
    );
  }
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n <= 0) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const desactive = await desactiverInstallation(ctx, n);
    if (!desactive) {
      return Response.json({ error: "Installation introuvable." },
        { status: 404 });
    }
    return Response.json({ data: { desactive: true } });
  } catch (e) {
    console.error("[installation-desactiver]", e);
    return Response.json({ error: "Désactivation impossible." },
      { status: 500 });
  }
}
