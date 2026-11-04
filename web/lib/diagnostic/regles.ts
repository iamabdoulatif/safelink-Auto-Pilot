import { db } from "@/lib/db";
import { REGLES_AUDIT, type Releve } from "./audit";

// Applique les regles d'audit a un releve et range chaque constat en base.
// Relancee a chaque releve : un constat deja connu est simplement revu
// (dernier_vu_le), jamais duplique. Un constat corrige qui reapparait est
// rouvert : l'etat du routeur a change, la base doit le dire.
export type ConstatEnregistre = {
  id: number; regle: string; titre: string;
  gravite: string; cible: string | null;
};

export async function analyser(routeurId: number, releveId: number) {
  const { rows } = await db.query(
    `SELECT routeur_id, donnees FROM releves WHERE id = $1`, [releveId]);
  const releve = rows[0];
  if (!releve || releve.routeur_id !== routeurId)
    throw new Error("Releve introuvable pour ce routeur.");
  const releveLu: Releve = {
    donnees: releve.donnees as Record<string, Record<string, unknown>>,
  };

  const constats: ConstatEnregistre[] = [];
  for (const regle of REGLES_AUDIT) {
    const trouve = regle.verifie(releveLu);
    if (!trouve) continue;
    // Les cles du releve n'ont pas de slash initial ("ip/dns"),
    // contrairement aux cibles ("/ip/dns").
    const section = (trouve.cible ?? regle.code).replace(/^\//, "");
    const { rows: lignes } = await db.query(
      `INSERT INTO constats (routeur_id, regle, categorie, gravite, cible,
        titre, constat, preuve, correctif, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ouvert')
       ON CONFLICT (routeur_id, regle, cible) DO UPDATE SET
         categorie = EXCLUDED.categorie, gravite = EXCLUDED.gravite,
         titre = EXCLUDED.titre, constat = EXCLUDED.constat,
         preuve = EXCLUDED.preuve, correctif = EXCLUDED.correctif,
         statut = 'ouvert', dernier_vu_le = now()
       RETURNING id, regle, titre, gravite, cible`,
      [routeurId, regle.code, regle.categorie, regle.gravite,
        trouve.cible ?? null, regle.titre, trouve.constat,
        { releve_id: releveId, extrait: releveLu.donnees[section] ?? null },
        trouve.correctif ?? null]);
    constats.push(lignes[0] as ConstatEnregistre);
  }
  return constats;
}
