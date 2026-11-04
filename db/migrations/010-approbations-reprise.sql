-- 010 : approbation dans l'application.
-- executions_n8n porte l'URL de reprise du node Wait n8n et l'espace
-- proprietaire, pour l'ecran d'approbation (statut 'en_attente').
-- Rejouable : IF NOT EXISTS partout.
ALTER TABLE executions_n8n
  ADD COLUMN IF NOT EXISTS url_reprise text;
ALTER TABLE executions_n8n
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'defaut';
CREATE INDEX IF NOT EXISTS idx_executions_tenant_statut
  ON executions_n8n (tenant_id, statut);
