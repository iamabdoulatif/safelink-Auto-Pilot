-- Vérification du numéro WhatsApp avant l'accès au SaaS.
-- numero_verifie vaut true par défaut : les comptes existants gardent
-- leur accès ; l'inscription le pose explicitement à false.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS numero_verifie boolean NOT NULL DEFAULT true;

-- Codes de validation : seul le haché est stocké, jamais le code en
-- clair. Un code vit 10 minutes, 5 tentatives maximum, usage unique.
CREATE TABLE IF NOT EXISTS verifications_whatsapp (
  id          bigserial   PRIMARY KEY,
  courriel    text        NOT NULL,
  code_hash   text        NOT NULL,
  expire_le   timestamptz NOT NULL,
  tentatives  integer     NOT NULL DEFAULT 0,
  consomme_le timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verifications_whatsapp_courriel
  ON verifications_whatsapp (courriel, created_at DESC);
