-- 004 : le lot part d'une configuration (003) : l'ancienne colonne
-- routeur_id (parc de supervision) devient un rappel historique nullable.
ALTER TABLE lots_tickets ALTER COLUMN routeur_id DROP NOT NULL;
