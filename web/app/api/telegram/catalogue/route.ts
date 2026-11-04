import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { dechiffrer } from "@/lib/chiffrement-serveur";
import { rosAvecIdentifiants, ErreurRouterOS } from "@/lib/routeros";

type Routeur = {
  id: number;
  nom: string;
  adresse_routeros: string;
  utilisateur_lecture: string;
  mot_de_passe_lecture_chiffre: string | null;
};

function secretValide(recu: string): boolean {
  const attendu = process.env.N8N_WEBHOOK_SECRET ?? "";
  if (!attendu || !recu) return false;
  const a = createHash("sha256").update(attendu).digest();
  const b = createHash("sha256").update(Buffer.from(recu)).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

function erreurRouterOS(e: unknown): string {
  if (e instanceof ErreurRouterOS) return `RouterOS HTTP ${e.statut}`;
  return "Routeur injoignable ou identifiants de lecture invalides";
}

export async function POST(req: Request) {
  if (!secretValide(req.headers.get("x-n8n-secret") ?? "")) {
    return Response.json({ error: "Secret invalide." }, { status: 401 });
  }
  let corps: unknown;
  try { corps = await req.json(); }
  catch { return Response.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  const b = (corps ?? {}) as Record<string, unknown>;
  const chatId = typeof b.chatId === "string" ? b.chatId.trim() : "";
  if (!chatId) return Response.json({ error: "chatId obligatoire." }, { status: 400 });

  try {
    const { rows: bots } = await db.query<{ tenant_id: string }>(
      "SELECT tenant_id FROM configurations_telegram WHERE chat_id = $1", [chatId]);
    if (bots.length === 0) return Response.json({ data: {
      routeurs: [], motif: "Aucun bot associé à cette discussion.",
    } });
    const { rows: routeurs } = await db.query<Routeur>(
      `SELECT id, nom, adresse_routeros, utilisateur_lecture,
         mot_de_passe_lecture_chiffre
       FROM configurations_routeurs
       WHERE tenant_id = $1 AND actif = true ORDER BY nom`, [bots[0].tenant_id]);
    const catalogue: Array<{
      id: number; nom: string; disponible: boolean;
      profils: Array<{ nom: string; serveur: string | null }>;
      erreur?: string;
    }> = [];
    for (const routeur of routeurs) {
      const entree = { id: routeur.id, nom: routeur.nom, disponible: false,
        profils: [] as Array<{ nom: string; serveur: string | null }>,
        ...(routeur.mot_de_passe_lecture_chiffre ? {} : {
          erreur: "Compte de lecture non configuré.",
        }) };
      if (!routeur.mot_de_passe_lecture_chiffre) { catalogue.push(entree); continue; }
      try {
        const ros = rosAvecIdentifiants(routeur.adresse_routeros,
          routeur.utilisateur_lecture, dechiffrer(routeur.mot_de_passe_lecture_chiffre));
        const brut = await ros.get<Record<string, unknown>[]>("/ip/hotspot/user/profile");
        entree.profils = (Array.isArray(brut) ? brut : [])
          .filter((p) => typeof p?.name === "string" && p.name.trim() !== "")
          .map((p) => ({ nom: String(p.name),
            serveur: typeof p.server === "string" ? p.server : null }));
        entree.disponible = true;
      } catch (e) { entree.erreur = erreurRouterOS(e); }
      catalogue.push(entree);
    }
    return Response.json({ data: { routeurs: catalogue } });
  } catch (e) {
    console.error("[telegram-catalogue]", e);
    return Response.json({ error: "Catalogue des routeurs indisponible." }, { status: 500 });
  }
}
