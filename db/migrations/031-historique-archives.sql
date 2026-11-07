-- Archivage de l'historique : les contrôles de routine toutes les
-- 15 minutes (0 ticket créé, aucun échec) sont archivés après
-- 30 jours pour ne pas noyer les vraies générations. Les lignes
-- archivées restent consultables dans l'onglet Archives, puis un
-- admin peut les supprimer définitivement.
ALTER TABLE ticket_generation_runs
  ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_runs_tenant_archive_date
  ON ticket_generation_runs (tenant_id, archive, created_at DESC);
