-- Destinataires des tickets par zone Wi-Fi (un routeur = une zone).
-- Informations renseignées depuis le SaaS (Configuration WhatsApp) :
-- localisation de la zone, commune, et numéros WhatsApp de l'admin,
-- du gérant et des vendeurs qui reçoivent le PDF à chaque génération.
-- Aucun mot de passe de ticket ici : uniquement des numéros de contact.
CREATE TABLE IF NOT EXISTS zones_wifi_destinataires (
  id                    bigserial   PRIMARY KEY,
  tenant_id             text        NOT NULL REFERENCES espaces(tenant_id)
                                  ON DELETE CASCADE,
  router_connection_id  bigint      NOT NULL
                                  REFERENCES configurations_routeurs(id)
                                  ON DELETE CASCADE,
  localisation          text        NOT NULL DEFAULT '',
  commune               text        NOT NULL DEFAULT '',
  numero_admin          text        NOT NULL DEFAULT '',
  numero_gerant         text        NOT NULL DEFAULT '',
  numeros_vendeurs      jsonb       NOT NULL DEFAULT '[]',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, router_connection_id)
);
CREATE INDEX IF NOT EXISTS idx_zones_wifi_tenant
  ON zones_wifi_destinataires (tenant_id);
