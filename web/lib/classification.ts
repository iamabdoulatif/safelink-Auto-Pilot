import { db } from "@/lib/db";

// Classification des inscrits du SaaS (supervision plateforme) :
// par pays (déclaré à l'inscription), nombre de MikroTik (routeurs)
// et de zones par personne, et répartition par commune des zones.
// Lecture seule, agrégats SQL : aucun secret, aucune donnée ticket.
export type LignePays = {
  pays: string; inscrits: number; routeurs: number; zones: number;
};
export type LignePersonne = {
  courriel: string; nom: string; pays: string;
  routeurs: number; zones: number; communes: string;
};
export type LigneCommune = {
  commune: string; zones: number; personnes: number;
};
export type ZoneCarte = {
  routeurNom: string; commune: string; localisation: string;
  latitude: number; longitude: number; proprietaire: string; pays: string;
  wifiNom: string; prixProfils: { profil: string; prix: number }[];
};

export async function classificationParPays(): Promise<LignePays[]> {
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(u.pays), ''), 'Non renseigné') AS pays,
       COUNT(DISTINCT u.courriel) AS inscrits,
       COUNT(DISTINCT r.id) AS routeurs,
       COUNT(DISTINCT z.router_connection_id) AS zones
     FROM utilisateurs u
     LEFT JOIN configurations_routeurs r ON r.tenant_id = u.courriel
     LEFT JOIN zones_wifi_destinataires z
       ON z.router_connection_id = r.id AND z.tenant_id = u.courriel
     GROUP BY 1 ORDER BY inscrits DESC, pays`,
  );
  return rows as LignePays[];
}

export async function classificationParPersonne(): Promise<LignePersonne[]> {
  const { rows } = await db.query(
    `SELECT u.courriel,
       TRIM(COALESCE(u.prenom, '') || ' ' || COALESCE(u.nom, '')) AS nom,
       COALESCE(NULLIF(TRIM(u.pays), ''), 'Non renseigné') AS pays,
       COUNT(DISTINCT r.id) AS routeurs,
       COUNT(DISTINCT z.router_connection_id) AS zones,
       COALESCE(string_agg(DISTINCT NULLIF(TRIM(z.commune), ''), ', '), '') AS communes
     FROM utilisateurs u
     LEFT JOIN configurations_routeurs r ON r.tenant_id = u.courriel
     LEFT JOIN zones_wifi_destinataires z
       ON z.router_connection_id = r.id AND z.tenant_id = u.courriel
     GROUP BY u.courriel, u.prenom, u.nom, u.pays
     ORDER BY routeurs DESC, u.courriel`,
  );
  return rows as LignePersonne[];
}

export async function classificationParCommune(): Promise<LigneCommune[]> {
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(z.commune), ''), 'Non renseignée') AS commune,
       COUNT(*) AS zones,
       COUNT(DISTINCT z.tenant_id) AS personnes
     FROM zones_wifi_destinataires z
     GROUP BY 1 ORDER BY zones DESC, commune`,
  );
  return rows as LigneCommune[];
}

// Zones placées précisément : les épingles de la carte.
export async function zonesGeolocalisees(): Promise<ZoneCarte[]> {
  const { rows } = await db.query(
    `SELECT r.nom AS "routeurNom", z.commune, z.localisation,
       z.latitude, z.longitude, z.tenant_id AS proprietaire,
       z.wifi_nom AS "wifiNom",
       COALESCE(z.prix_profils, '[]') AS "prixProfils",
       COALESCE(NULLIF(TRIM(u.pays), ''), 'Non renseigné') AS pays
     FROM zones_wifi_destinataires z
     JOIN configurations_routeurs r
       ON r.id = z.router_connection_id AND r.tenant_id = z.tenant_id
     LEFT JOIN utilisateurs u ON u.courriel = z.tenant_id
     WHERE z.latitude IS NOT NULL AND z.longitude IS NOT NULL
     ORDER BY r.nom`,
  );
  return rows as ZoneCarte[];
}
