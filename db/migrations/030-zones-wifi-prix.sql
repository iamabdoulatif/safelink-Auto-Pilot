-- Épingles de carte enrichies : nom du Wi-Fi affiché aux clients
-- et prix pratiqués par l'opérateur dans la zone (par profil),
-- renseignés dans la fiche zone du dashboard.
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS wifi_nom text NOT NULL DEFAULT '';
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS prix_profils jsonb NOT NULL DEFAULT '[]';
