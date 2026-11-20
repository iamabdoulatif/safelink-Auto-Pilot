-- Canal du rapport des ventes : ajout de « les_deux » (WhatsApp ET
-- Telegram en un seul cycle). Utile pour les zones sans vendeur ni
-- gérant (Mikhmon V3/V2) qui veulent le rapport journalier sur les
-- deux canaux à la fois, vers les numéros/chat configurés.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zones_wifi_rapport_canal_valide'
  ) THEN
    ALTER TABLE zones_wifi_destinataires
      DROP CONSTRAINT zones_wifi_rapport_canal_valide;
  END IF;
  ALTER TABLE zones_wifi_destinataires
    ADD CONSTRAINT zones_wifi_rapport_canal_valide
    CHECK (rapport_canal IN ('telegram', 'whatsapp', 'les_deux'));
END $$;
