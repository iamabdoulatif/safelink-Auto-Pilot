-- 014 : reinitialisation du mot de passe.
-- Seule l'empreinte du jeton est stockee : la base ne permet pas de
-- reutiliser un lien. mot_de_passe_change_le revoque les anciennes sessions.
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS mot_de_passe_change_le timestamptz;

CREATE TABLE IF NOT EXISTS reinitialisations_mot_de_passe (
  id          bigserial PRIMARY KEY,
  courriel    text NOT NULL REFERENCES utilisateurs(courriel) ON DELETE CASCADE,
  empreinte   text NOT NULL UNIQUE,
  expire_le   timestamptz NOT NULL,
  utilise_le  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reinitialisations_courriel
  ON reinitialisations_mot_de_passe (courriel, created_at);
