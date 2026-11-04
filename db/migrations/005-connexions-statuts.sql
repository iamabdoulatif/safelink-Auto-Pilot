-- 005 : statuts et champs de connexion (Mikhmon + RouterOS + Telegram).
--
-- Contexte : les tables configurations_routeurs et configurations_telegram
-- existent deja (002). On AJOUTE uniquement les colonnes manquantes, sans
-- rien supprimer ni modifier en destructeur : chaque colonne est ajoutee
-- avec IF NOT EXISTS et chaque contrainte dans un bloc DO conditionnel.
-- Les mots de passe des tickets Hotspot ne sont JAMAIS stockes : ils
-- vivent dans /ip/hotspot/user sur le routeur.
--
-- Correspondance avec le vocabulaire metier :
--   installations Mikhmon  -> configurations_routeurs (hote, port, role...)
--   connexions RouterOS    -> configurations_routeurs (adresse, users...)
--   bots Telegram          -> configurations_telegram (nom, statut...)

-- 1) Installations Mikhmon + connexions RouterOS.
ALTER TABLE configurations_routeurs
  ADD COLUMN IF NOT EXISTS hote text,
  ADD COLUMN IF NOT EXISTS port integer NOT NULL DEFAULT 8088,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Administrateur',
  ADD COLUMN IF NOT EXISTS serveur_hotspot text,
  ADD COLUMN IF NOT EXISTS statut_connexion text NOT NULL DEFAULT 'jamais-teste',
  ADD COLUMN IF NOT EXISTS dernier_test_le timestamptz,
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;

-- Role Mikhmon : Administrateur | Gerant | Vendeur (libelles de l'interface).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_routeurs_role_valide'
  ) THEN
    ALTER TABLE configurations_routeurs
      ADD CONSTRAINT configurations_routeurs_role_valide
      CHECK (role IN ('Administrateur', 'Gerant', 'Vendeur'));
  END IF;
END $$;

-- Statut de connexion : jamais-teste | en-ligne | hors-ligne | erreur.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_routeurs_statut_valide'
  ) THEN
    ALTER TABLE configurations_routeurs
      ADD CONSTRAINT configurations_routeurs_statut_valide
      CHECK (statut_connexion IN
        ('jamais-teste', 'en-ligne', 'hors-ligne', 'erreur'));
  END IF;
END $$;

-- Port TCP : 1 a 65535, jamais de flottant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_routeurs_port_valide'
  ) THEN
    ALTER TABLE configurations_routeurs
      ADD CONSTRAINT configurations_routeurs_port_valide
      CHECK (port BETWEEN 1 AND 65535);
  END IF;
END $$;

-- Reprise : pour les lignes existantes, deduire l'hote depuis url_mikhmon
-- (ex. http://127.0.0.1:8088/admin.php?id=login -> 127.0.0.1).
UPDATE configurations_routeurs
SET hote = substring(url_mikhmon FROM '^https?://([^/:[:space:]]+)')
WHERE hote IS NULL;

-- 2) Bots Telegram (central et personnalises).
ALTER TABLE configurations_telegram
  ADD COLUMN IF NOT EXISTS nom text,
  ADD COLUMN IF NOT EXISTS statut_connexion text NOT NULL DEFAULT 'jamais-teste',
  ADD COLUMN IF NOT EXISTS dernier_test_le timestamptz,
  ADD COLUMN IF NOT EXISTS secret_webhook text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_telegram_statut_valide'
  ) THEN
    ALTER TABLE configurations_telegram
      ADD CONSTRAINT configurations_telegram_statut_valide
      CHECK (statut_connexion IN
        ('jamais-teste', 'en-ligne', 'hors-ligne', 'erreur'));
  END IF;
END $$;
