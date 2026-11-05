import { db } from "@/lib/db";

// Vue superadmin : un utilisateur inscrit = un espace (tenant), dont le
// tenant_id est le courriel. Les compteurs suivent les mêmes règles que
// le tableau de bord : constats ouverts seulement, dernier relevé réussi.
export type UtilisateurAdmin = {
  courriel: string;
  nom: string | null;
  prenom: string | null;
  inscritLe: Date | string;
  routeurs: number;
  critiques: number;
  majeurs: number;
  dernierReleve: Date | string | null;
};

type LigneUtilisateur = {
  courriel: string;
  nom: string | null;
  prenom: string | null;
  inscrit_le: Date | string;
  routeurs: string;
  critiques: string;
  majeurs: string;
  dernier_releve: Date | string | null;
};

export async function listerUtilisateurs(): Promise<UtilisateurAdmin[]> {
  const { rows } = await db.query<LigneUtilisateur>(
    `SELECT u.courriel, u.nom, u.prenom, u.created_at AS inscrit_le,
       count(DISTINCT r.id) AS routeurs,
       count(c.id) FILTER (WHERE c.gravite = 'critique') AS critiques,
       count(c.id) FILTER (WHERE c.gravite = 'majeure') AS majeurs,
       (SELECT max(rv.mesure_le) FROM releves rv
          JOIN routeurs rr ON rr.id = rv.routeur_id
         WHERE rr.tenant_id = u.tenant_id AND rv.statut <> 'injoignable') AS dernier_releve
     FROM utilisateurs u
     LEFT JOIN routeurs r ON r.tenant_id = u.tenant_id AND r.actif
     LEFT JOIN constats c ON c.routeur_id = r.id AND c.statut = 'ouvert'
     GROUP BY u.id, u.courriel, u.nom, u.prenom, u.created_at, u.tenant_id
     ORDER BY u.courriel`,
  );
  return rows.map((r) => ({
    courriel: r.courriel,
    nom: r.nom,
    prenom: r.prenom,
    inscritLe: r.inscrit_le,
    routeurs: Number(r.routeurs),
    critiques: Number(r.critiques),
    majeurs: Number(r.majeurs),
    dernierReleve: r.dernier_releve,
  }));
}

export type RouteurAdmin = {
  id: number;
  nom: string;
  url_base: string;
  modele: string | null;
  dernier_releve: Date | string | null;
  critiques: string;
  majeurs: string;
};

// Équipements d'un seul espace, pour la vue détaillée du superadmin.
// Même requête que le parc de l'utilisateur, mais tenant imposé par
// l'URL et vérifié côté superadmin avant l'appel.
export async function listerRouteursUtilisateur(
  tenantId: string,
): Promise<RouteurAdmin[]> {
  const { rows } = await db.query<RouteurAdmin>(
    `SELECT r.id, r.nom, r.url_base, r.modele,
      (SELECT max(mesure_le) FROM releves
        WHERE routeur_id = r.id AND statut <> 'injoignable') AS dernier_releve,
      count(c.id) FILTER (WHERE c.gravite = 'critique') AS critiques,
      count(c.id) FILTER (WHERE c.gravite = 'majeure') AS majeurs
    FROM routeurs r
    LEFT JOIN constats c ON c.routeur_id = r.id AND c.statut = 'ouvert'
    WHERE r.actif AND r.tenant_id = $1
    GROUP BY r.id ORDER BY r.nom`,
    [tenantId],
  );
  return rows;
}

export async function utilisateurExiste(courriel: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM utilisateurs WHERE courriel = $1`,
    [courriel],
  );
  return rows.length > 0;
}
