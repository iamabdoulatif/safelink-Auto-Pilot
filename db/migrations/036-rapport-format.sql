-- Format du fichier joint au rapport des ventes, par zone :
-- xlsx (Excel mis en forme, défaut), csv (données brutes), doc (Word .docx).
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_format text NOT NULL DEFAULT 'xlsx';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zones_wifi_rapport_format_valide') THEN
    ALTER TABLE zones_wifi_destinataires
      ADD CONSTRAINT zones_wifi_rapport_format_valide CHECK (rapport_format IN ('xlsx', 'csv', 'doc'));
  END IF;
END $$;
