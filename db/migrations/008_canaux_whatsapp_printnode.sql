-- 008 : configurations WhatsApp et PrintNode par espace.
--
-- Une ligne par tenant (UNIQUE), isolee comme Telegram. Les secrets
-- (secret WhatsApp, cle PrintNode) sont chiffres cote application
-- (AES-256-GCM) et ne sont JAMAIS renvoyes ni journalises.
-- L'impression automatique est refusee tant que PrintNode n'est pas
-- configure ET teste (statut_connexion = 'en-ligne').

-- 1) WhatsApp : webhook adaptateur + destinataire + secret eventuel.
CREATE TABLE IF NOT EXISTS configurations_whatsapp (
  id                bigserial   PRIMARY KEY,
  tenant_id         text        NOT NULL UNIQUE REFERENCES espaces(tenant_id)
                                ON DELETE CASCADE,
  utilisateur_id    text        NOT NULL,
  webhook_url       text        NOT NULL,
  secret_chiffre    text, -- NULL si l'adaptateur n'exige pas de secret
  destinataire_defaut text      NOT NULL DEFAULT '',
  actif             boolean     NOT NULL DEFAULT true,
  statut_connexion  text        NOT NULL DEFAULT 'jamais-teste',
  dernier_test_le   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_whatsapp_statut_valide'
  ) THEN
    ALTER TABLE configurations_whatsapp
      ADD CONSTRAINT configurations_whatsapp_statut_valide
      CHECK (statut_connexion IN
        ('jamais-teste', 'en-ligne', 'hors-ligne', 'erreur'));
  END IF;
END $$;

-- 2) PrintNode : cle API + imprimante + format papier.
CREATE TABLE IF NOT EXISTS configurations_printnode (
  id                bigserial   PRIMARY KEY,
  tenant_id         text        NOT NULL UNIQUE REFERENCES espaces(tenant_id)
                                ON DELETE CASCADE,
  utilisateur_id    text        NOT NULL,
  cle_chiffre       text, -- cle API chiffree, jamais reafficher
  printer_id        integer, -- identifiant PrintNode de l'imprimante
  nom_imprimante    text, -- renseigne par le test (liste des imprimantes)
  format_papier     text        NOT NULL DEFAULT 'A4',
  actif             boolean     NOT NULL DEFAULT true,
  statut_connexion  text        NOT NULL DEFAULT 'jamais-teste',
  dernier_test_le   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_printnode_statut_valide'
  ) THEN
    ALTER TABLE configurations_printnode
      ADD CONSTRAINT configurations_printnode_statut_valide
      CHECK (statut_connexion IN
        ('jamais-teste', 'en-ligne', 'hors-ligne', 'erreur'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configurations_printnode_format_valide'
  ) THEN
    ALTER TABLE configurations_printnode
      ADD CONSTRAINT configurations_printnode_format_valide
      CHECK (format_papier IN ('A4', 'A5', 'Letter'));
  END IF;
END $$;
