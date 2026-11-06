import { db } from "@/lib/db";
import type { ContexteTenant } from "@/lib/acces-donnees";
import { verifierContexte } from "@/lib/acces-donnees";
import type { DestinataireSupplementaire } from "@/lib/destinataires-supplementaires";
import { destinatairesZone } from "@/lib/zones-wifi-validation";
import type { EntreeZoneWifi } from "@/lib/zones-wifi-validation";
export {
  MAX_VENDEURS,
  nettoyerNumero,
  destinatairesZone,
  fusionnerDestinataires,
  validerZoneWifi,
} from "@/lib/zones-wifi-validation";
export type { EntreeZoneWifi } from "@/lib/zones-wifi-validation";

// Destinataires des tickets par zone Wi-Fi (un routeur = une zone).
// L'admin renseigne depuis le SaaS : localisation, commune, et les
// numéros WhatsApp de l'admin, du gérant et des vendeurs de la zone.
// À chaque génération sur ce routeur, le PDF part aussi (WhatsApp)
// vers ces numéros, en plus du canal principal (Telegram, etc.).
// La validation est pure et testable ; la base ne fait que stocker.

export type ZoneWifi = EntreeZoneWifi & {
  routerConnectionId: number;
  routeurNom: string;
  varianteMikhmon: string;
};

type LigneZone = {
  router_connection_id: number;
  routeur_nom: string;
  variante_mikhmon: string;
  localisation: string | null;
  commune: string | null;
  numero_admin: string | null;
  numero_gerant: string | null;
  numeros_vendeurs: string[] | null;
};

function versZone(l: LigneZone): ZoneWifi {
  return {
    routerConnectionId: Number(l.router_connection_id),
    routeurNom: l.routeur_nom,
    varianteMikhmon: l.variante_mikhmon,
    localisation: l.localisation ?? "",
    commune: l.commune ?? "",
    numeroAdmin: l.numero_admin ?? "",
    numeroGerant: l.numero_gerant ?? "",
    numerosVendeurs: Array.isArray(l.numeros_vendeurs) ? l.numeros_vendeurs : [],
  };
}

const SELECT_ZONES = `SELECT r.id AS router_connection_id, r.nom AS routeur_nom,
    r.variante_mikhmon, z.localisation, z.commune, z.numero_admin,
    z.numero_gerant, z.numeros_vendeurs
  FROM configurations_routeurs r
  LEFT JOIN zones_wifi_destinataires z
    ON z.router_connection_id = r.id AND z.tenant_id = r.tenant_id
  WHERE r.tenant_id = $1
  ORDER BY r.nom`;

// Toutes les zones de l'espace (routeurs sans fiche = champs vides).
export async function listerZonesWifi(ctx: ContexteTenant): Promise<ZoneWifi[]> {
  verifierContexte(ctx);
  const { rows } = await db.query(SELECT_ZONES, [ctx.tenantId]);
  return (rows as LigneZone[]).map(versZone);
}

// Enregistre la fiche d'une zone (routeur de l'espace uniquement).
export async function enregistrerZoneWifi(
  ctx: ContexteTenant,
  routerConnectionId: number,
  entree: EntreeZoneWifi,
): Promise<{ zone: ZoneWifi } | { erreur: string }> {
  verifierContexte(ctx);
  const { rows: routeurs } = await db.query(
    "SELECT id, nom, variante_mikhmon FROM configurations_routeurs WHERE id = $1 AND tenant_id = $2",
    [routerConnectionId, ctx.tenantId],
  );
  if (routeurs.length === 0) return { erreur: "Routeur inconnu." };
  await db.query(
    `INSERT INTO zones_wifi_destinataires
       (tenant_id, router_connection_id, localisation, commune,
        numero_admin, numero_gerant, numeros_vendeurs, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (tenant_id, router_connection_id) DO UPDATE
     SET localisation=$3, commune=$4, numero_admin=$5, numero_gerant=$6,
         numeros_vendeurs=$7, updated_at=now()`,
    [ctx.tenantId, routerConnectionId, entree.localisation, entree.commune,
      entree.numeroAdmin, entree.numeroGerant,
      JSON.stringify(entree.numerosVendeurs)],
  );
  const zones = await listerZonesWifi(ctx);
  const zone = zones.find((z) => z.routerConnectionId === routerConnectionId);
  return zone ? { zone } : { erreur: "Zone introuvable après enregistrement." };
}

// Destinataires WhatsApp d'un routeur, pour une génération en cours.
// Zone non renseignée = liste vide (aucune copie, aucun blocage).
export async function destinatairesZonePourRouteur(
  tenantId: string,
  routerConnectionId: number | null,
): Promise<DestinataireSupplementaire[]> {
  if (routerConnectionId === null) return [];
  const { rows } = await db.query(
    `SELECT numero_admin, numero_gerant, numeros_vendeurs
     FROM zones_wifi_destinataires
     WHERE tenant_id = $1 AND router_connection_id = $2`,
    [tenantId, routerConnectionId],
  );
  const lignes = rows as {
    numero_admin: string; numero_gerant: string; numeros_vendeurs: string[];
  }[];
  if (lignes.length === 0) return [];
  return destinatairesZone({
    numeroAdmin: lignes[0].numero_admin,
    numeroGerant: lignes[0].numero_gerant,
    numerosVendeurs: Array.isArray(lignes[0].numeros_vendeurs)
      ? lignes[0].numeros_vendeurs : [],
  });
}
