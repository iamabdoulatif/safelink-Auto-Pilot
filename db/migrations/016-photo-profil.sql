-- 016 : photo de profil, stockee en base (2 Mo maximum, verifies par l'application).
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS photo bytea,
  ADD COLUMN IF NOT EXISTS photo_type text,
  ADD COLUMN IF NOT EXISTS photo_change_le timestamptz;
