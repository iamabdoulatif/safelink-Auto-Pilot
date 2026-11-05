import { db } from "@/lib/db";
import { detecterTypeImage, TAILLE_MAX_PHOTO } from "@/lib/photo-profil";
import { reponseAuthentification, session } from "@/lib/session";

// Photo du compte connecte. GET sert l'image elle-meme (pas de { data }) ;
// les erreurs et les ecritures suivent le format { data } / { error }.
function erreurServeur(e: unknown, message: string): Response {
  const refus = reponseAuthentification(e);
  if (refus) return refus;
  console.error("[profil-photo]", message);
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const { utilisateurId } = await session();
    const { rows } = await db.query<{ photo: Buffer | null; photo_type: string | null }>(
      "SELECT photo, photo_type FROM utilisateurs WHERE courriel = $1",
      [utilisateurId],
    );
    const ligne = rows[0];
    if (!ligne?.photo || !ligne.photo_type) {
      return Response.json({ error: "Aucune photo." }, { status: 404 });
    }
    return new Response(new Uint8Array(ligne.photo), {
      headers: {
        "Content-Type": ligne.photo_type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (e) {
    return erreurServeur(e, "Lecture de la photo impossible.");
  }
}

export async function POST(req: Request) {
  try {
    const { utilisateurId } = await session();
    const longueur = Number(req.headers.get("content-length") ?? 0);
    if (longueur > TAILLE_MAX_PHOTO + 64 * 1024) {
      return Response.json({ error: "Photo trop lourde (2 Mo maximum)." }, { status: 413 });
    }
    let fichier: FormDataEntryValue | null;
    try {
      fichier = (await req.formData()).get("photo");
    } catch {
      return Response.json({ error: "Formulaire invalide." }, { status: 400 });
    }
    if (!(fichier instanceof File)) {
      return Response.json({ error: "Photo manquante." }, { status: 400 });
    }
    if (fichier.size > TAILLE_MAX_PHOTO) {
      return Response.json({ error: "Photo trop lourde (2 Mo maximum)." }, { status: 413 });
    }
    const octets = new Uint8Array(await fichier.arrayBuffer());
    const type = detecterTypeImage(octets);
    if (!type) {
      return Response.json({ error: "Format accepté : JPEG, PNG ou WebP." }, { status: 400 });
    }
    await db.query(
      `UPDATE utilisateurs
       SET photo = $1, photo_type = $2, photo_change_le = now()
       WHERE courriel = $3`,
      [Buffer.from(octets), type, utilisateurId],
    );
    return Response.json({ data: { enregistree: true } }, { status: 201 });
  } catch (e) {
    return erreurServeur(e, "Enregistrement de la photo impossible.");
  }
}

export async function DELETE() {
  try {
    const { utilisateurId } = await session();
    await db.query(
      `UPDATE utilisateurs
       SET photo = NULL, photo_type = NULL, photo_change_le = now()
       WHERE courriel = $1`,
      [utilisateurId],
    );
    return Response.json({ data: { supprimee: true } });
  } catch (e) {
    return erreurServeur(e, "Suppression de la photo impossible.");
  }
}
