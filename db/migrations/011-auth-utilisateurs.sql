-- 011 : comptes utilisateurs (authentification serveur).
-- Un compte = un courriel + un mot de passe hache (scrypt, jamais en
-- clair) rattache a un espace. L'espace isole les donnees : chaque
-- requete filtre sur tenant_id (voir 002). La session est un cookie
-- signe cote serveur, jamais un en-tete fourni par le client.
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                bigserial   PRIMARY KEY,
  tenant_id         text        NOT NULL REFERENCES espaces(tenant_id)
                                  ON DELETE CASCADE,
  courriel          text        NOT NULL UNIQUE,
  hash_mot_de_passe text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_tenant
  ON utilisateurs (tenant_id);
