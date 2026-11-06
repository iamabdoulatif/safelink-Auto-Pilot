-- Rôles métier d'un espace (version Mikhmon SafeLinkHub SF) :
-- admin (gère tout), gerant (génère, envoie et configure les règles),
-- vendeur (consulte et reçoit les tickets à vendre).
-- Les anciens rôles sont convertis, jamais supprimés :
-- contributeur devient gerant, utilisateur devient vendeur.
UPDATE membres_espace SET role = 'gerant' WHERE role = 'contributeur';
UPDATE membres_espace SET role = 'vendeur' WHERE role = 'utilisateur';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membres_espace_role_check'
  ) THEN
    ALTER TABLE membres_espace DROP CONSTRAINT membres_espace_role_check;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membres_espace_role_valide'
  ) THEN
    ALTER TABLE membres_espace
      ADD CONSTRAINT membres_espace_role_valide
      CHECK (role IN ('admin', 'gerant', 'vendeur'));
  END IF;
END $$;
