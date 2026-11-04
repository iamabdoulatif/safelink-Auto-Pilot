-- 007 : reapprovisionnement automatique et historique des generations.
--
-- - abonnements_tickets : rattachement a une configuration (identifiants
--   chiffres du tenant) en plus du parc historique, quantite cible,
--   destinataires par canal, etat de la derniere ronde (verif, stock,
--   erreur). L'activation explicite d'un abonnement vaut validation
--   humaine prealable ; chaque generation reste journalisee.
-- - ticket_generation_runs : stocks avant/apres, seuil, cible et
--   destinataire pour l'historique demande. Aucun secret n'y figure :
--   ni mot de passe (Mikhmon, RouterOS, tickets), ni jeton, ni cle.
-- - configurations_routeurs : mot de passe de lecture stocke chiffre
--   (section « Mes routeurs » l'exige) ; il ne sert qu'a des lectures
--   (tests, profils, stocks) et n'est jamais reaffiche ni journalise.

-- 1) Mot de passe de lecture (lectures seules, jamais reaffiche).
ALTER TABLE configurations_routeurs
  ADD COLUMN IF NOT EXISTS mot_de_passe_lecture_chiffre text;

-- 2) Abonnements : configuration cible + cible de generation + etat.
ALTER TABLE abonnements_tickets
  ADD COLUMN IF NOT EXISTS configuration_routeur_id bigint
    REFERENCES configurations_routeurs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quantite_cible integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_recipient text,
  ADD COLUMN IF NOT EXISTS printnode_printer_id text,
  ADD COLUMN IF NOT EXISTS derniere_verif_le timestamptz,
  ADD COLUMN IF NOT EXISTS dernier_stock integer,
  ADD COLUMN IF NOT EXISTS derniere_erreur text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'abonnements_tickets_cible_valide'
  ) THEN
    ALTER TABLE abonnements_tickets
      ADD CONSTRAINT abonnements_tickets_cible_valide
      CHECK (quantite_cible > 0 AND quantite_cible <= 500);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'abonnements_tickets_canal_valide'
  ) THEN
    ALTER TABLE abonnements_tickets
      ADD CONSTRAINT abonnements_tickets_canal_valide
      CHECK (canal IN
        ('interface', 'telegram', 'whatsapp', 'printnode', 'pdf'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_abos_config
  ON abonnements_tickets (configuration_routeur_id);

-- 3) Runs : donnees d'historique (quantites entieres, jamais de flottant).
ALTER TABLE ticket_generation_runs
  ADD COLUMN IF NOT EXISTS stock_avant integer,
  ADD COLUMN IF NOT EXISTS stock_apres integer,
  ADD COLUMN IF NOT EXISTS seuil integer,
  ADD COLUMN IF NOT EXISTS quantite_cible integer,
  ADD COLUMN IF NOT EXISTS destinataire text,
  ADD COLUMN IF NOT EXISTS whatsapp_recipient text,
  ADD COLUMN IF NOT EXISTS printnode_printer_id text;
