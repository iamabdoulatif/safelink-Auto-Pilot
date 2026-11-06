import { lireImageMikrotik } from "@/lib/images-mikrotik";

// Photographie produit du catalogue MikroTik, servie depuis la base.
// Contenu public (aucune donnée d'espace) : la route est hors /api,
// donc hors du portier de session, comme les fichiers de public/.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Image introuvable." }, { status: 404 });
  }
  const image = await lireImageMikrotik(id);
  if (!image) {
    return Response.json({ error: "Image introuvable." }, { status: 404 });
  }
  return new Response(new Uint8Array(image.donnees), {
    headers: {
      "Content-Type": image.typeMime,
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
