-- Approbation humaine avant génération automatique, configurée
-- dans le dashboard par règle : l'utilisateur choisit s'il veut
-- consentir (Telegram ou WhatsApp) avant chaque génération.
-- Copiée sur le run à sa création : un run garde le réglage du moment.
ALTER TABLE auto_replenishment_settings
  ADD COLUMN IF NOT EXISTS approbation_requise boolean NOT NULL DEFAULT false;
ALTER TABLE auto_replenishment_settings
  ADD COLUMN IF NOT EXISTS approbation_canal text NOT NULL DEFAULT 'telegram';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auto_replenishment_settings_approbation_canal_valide'
  ) THEN
    ALTER TABLE auto_replenishment_settings
      ADD CONSTRAINT auto_replenishment_settings_approbation_canal_valide
      CHECK (approbation_canal IN ('telegram', 'whatsapp'));
  END IF;
END $$;

ALTER TABLE ticket_generation_runs
  ADD COLUMN IF NOT EXISTS approbation_requise boolean NOT NULL DEFAULT false;
ALTER TABLE ticket_generation_runs
  ADD COLUMN IF NOT EXISTS approbation_canal text NOT NULL DEFAULT 'telegram';
