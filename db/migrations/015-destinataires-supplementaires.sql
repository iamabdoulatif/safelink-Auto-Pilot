-- 015 : autres destinataires du PDF, par regle de reapprovisionnement.
-- Copies sur le run : un run garde la liste valable au moment de sa creation.
ALTER TABLE auto_replenishment_settings
  ADD COLUMN IF NOT EXISTS destinataires_supplementaires jsonb NOT NULL DEFAULT '[]';

ALTER TABLE ticket_generation_runs
  ADD COLUMN IF NOT EXISTS destinataires_supplementaires jsonb NOT NULL DEFAULT '[]';
