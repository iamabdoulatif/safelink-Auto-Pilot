-- Localisation précise des zones Wi-Fi (OpenStreetMap) :
-- coordonnées saisies ou cherchées depuis le dashboard, pour
-- cartographier les routeurs et zones ajoutés. NULL = non placé.
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS longitude double precision;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zones_wifi_coordonnees_valides'
  ) THEN
    ALTER TABLE zones_wifi_destinataires
      ADD CONSTRAINT zones_wifi_coordonnees_valides CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
      );
  END IF;
END $$;
