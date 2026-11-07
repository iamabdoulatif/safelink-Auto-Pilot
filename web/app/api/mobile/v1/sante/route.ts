// Santé publique de l'API mobile (aucune donnée, aucun secret).
export async function GET() {
  return Response.json({ data: { statut: "ok", api: "mobile", version: "v1" } });
}
