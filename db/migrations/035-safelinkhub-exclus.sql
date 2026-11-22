-- Routeurs SafeLinkHub que l'espace a retirés de son parc : la
-- reconnaissance automatique ne les réimporte plus (identifiants SafeLinkHub).
ALTER TABLE liaisons_safelinkhub
  ADD COLUMN IF NOT EXISTS exclus text[] NOT NULL DEFAULT '{}';
