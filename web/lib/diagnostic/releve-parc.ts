import { db } from "@/lib/db";
import { collecter } from "@/lib/diagnostic/collecte";
import { analyser } from "@/lib/diagnostic/regles";

// Relevés en série courte : sans eux, une carte du parc reste à « Dernier
// relevé : jamais » (aucune donnée CPU/RAM) tant que personne ne clique.
// Appelé par le cron (/api/routeurs/releves) et à l'ajout d'un routeur.
// ponytail: 4 relevés en parallèle, à revoir si le parc dépasse ~200 routeurs.
export async function releverParc(opts: { ids?: number[]; plusVieuxQueMin?: number } = {}) {
  const { rows } = await db.query<{ id: number; nom: string; url_base: string }>(
    `SELECT r.id, r.nom, r.url_base FROM routeurs r
     WHERE r.actif = true
       AND ($1::int[] IS NULL OR r.id = ANY($1))
       AND NOT EXISTS (SELECT 1 FROM releves v WHERE v.routeur_id = r.id
                       AND v.mesure_le > now() - make_interval(mins => $2))
     ORDER BY r.id`,
    [opts.ids ?? null, opts.plusVieuxQueMin ?? 0],
  );
  const bilan: { nom: string; statut: string }[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (i < rows.length) {
        const r = rows[i++];
        try {
          const { releveId, statut } = await collecter(r.id, r.url_base);
          await analyser(r.id, releveId);
          bilan.push({ nom: r.nom, statut });
        } catch (e) {
          bilan.push({ nom: r.nom, statut: "erreur : " + (e instanceof Error ? e.message : "échec") });
        }
      }
    }),
  );
  return bilan;
}
