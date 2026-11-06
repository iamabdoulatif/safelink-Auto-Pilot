-- Lots distincts par vendeur : à la génération, chaque vendeur de
-- la zone reçoit son propre lot de tickets (commentaire RouterOS
-- vc-<lot>-<date>). Cette table fait le lien lot -> numéro du
-- vendeur, pour que le rapport des ventes calcule les montants
-- individuels. Aucun identifiant ni mot de passe de ticket ici :
-- uniquement un numéro de lot (100 à 999) et un numéro WhatsApp.
CREATE TABLE IF NOT EXISTS lots_vendeurs (
  tenant_id            text   NOT NULL REFERENCES espaces(tenant_id)
                             ON DELETE CASCADE,
  router_connection_id bigint NOT NULL
                             REFERENCES configurations_routeurs(id)
                             ON DELETE CASCADE,
  lot                  integer NOT NULL,
  numero_vendeur       text   NOT NULL,
  cree_le              date   NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (tenant_id, router_connection_id, lot)
);
CREATE INDEX IF NOT EXISTS idx_lots_vendeurs_tenant
  ON lots_vendeurs (tenant_id, router_connection_id);
