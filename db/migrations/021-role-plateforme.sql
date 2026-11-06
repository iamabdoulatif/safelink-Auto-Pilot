-- Rôle de plateforme de chaque compte : admin (supervision des
-- utilisateurs) ou contributeur (compte ordinaire, défaut). Le
-- superadmin n'est pas stocké : il vient de SUPERADMIN_COURRIELS.
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS role_plateforme text NOT NULL DEFAULT 'contributeur'
  CHECK (role_plateforme IN ('admin', 'contributeur'));
