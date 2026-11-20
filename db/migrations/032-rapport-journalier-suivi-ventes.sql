-- Rapport journalier des ventes + suivi de l'heure de vente.
--
-- 1) Le cycle « journalier » rejoint les planifications possibles
--    d'une zone : chaque jour, la veille de 00h à 00h, envoyé au
--    premier cycle n8n qui suit minuit.
-- 2) RouterOS ne stocke pas l'heure de première utilisation d'un
--    ticket. Le workflow relève donc les tickets utilisés à chaque
--    cycle de 15 minutes et l'application mémorise la première fois
--    qu'elle voit chacun d'eux. Seule l'empreinte SHA-256 du code
--    du ticket est stockée : jamais le code ni le mot de passe
--    (ils vivent dans le routeur, comme partout ailleurs ici).
--    heure_connue vaut vrai quand le lot est récent (hier ou
--    aujourd'hui) : l'heure relevée est alors celle de la vente,
--    à 15 minutes près. Pour un lot ancien vu pour la première
--    fois, le rapport retombe sur la date du lot, sans heure.

ALTER TABLE zones_wifi_destinataires
  DROP CONSTRAINT IF EXISTS zones_wifi_rapport_planification_valide;
ALTER TABLE zones_wifi_destinataires
  ADD CONSTRAINT zones_wifi_rapport_planification_valide
  CHECK (rapport_planification IN
    ('journalier', 'decade', 'hebdomadaire', 'mensuel', 'personnalise'));

CREATE TABLE IF NOT EXISTS suivi_ventes_tickets (
  tenant_id            text    NOT NULL REFERENCES espaces(tenant_id)
                               ON DELETE CASCADE,
  router_connection_id bigint  NOT NULL
                               REFERENCES configurations_routeurs(id)
                               ON DELETE CASCADE,
  ticket_hash          text    NOT NULL,
  profil               text    NOT NULL DEFAULT '',
  lot                  integer,
  lot_date             date,
  premiere_utilisation_le timestamptz NOT NULL DEFAULT now(),
  heure_connue         boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, router_connection_id, ticket_hash)
);
CREATE INDEX IF NOT EXISTS idx_suivi_ventes_periode
  ON suivi_ventes_tickets (tenant_id, router_connection_id, premiere_utilisation_le);
