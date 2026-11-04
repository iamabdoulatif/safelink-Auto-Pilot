-- 003 : les lots de tickets partent d'une CONFIGURATION routeur
-- (identifiants chiffres du tenant), pas d'une ligne du parc de
-- supervision. L'ancienne cle vers routeurs est levee au profit d'un
-- lien vers configurations_routeurs. Les lignes existantes gardent
-- leur routeur_id historique.
ALTER TABLE lots_tickets
  ADD COLUMN IF NOT EXISTS configuration_routeur_id bigint
    REFERENCES configurations_routeurs(id) ON DELETE CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lots_tickets_routeur_id_fkey'
  ) THEN
    ALTER TABLE lots_tickets DROP CONSTRAINT lots_tickets_routeur_id_fkey;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_lots_config
  ON lots_tickets (configuration_routeur_id);
