-- 009 : reapprovisionnement automatique par utilisateur, pilote par n8n.
--
-- Contexte : les configurations par espace existent deja (002/005/007/008).
-- Cette migration ajoute UNIQUEMENT ce qui manque pour que SafeLink-Auto-Pilot
-- devienne la source de configuration par utilisateur de n8n :
--   - hotspot_profiles : profils Hotspot valides par routeur et par espace ;
--   - auto_replenishment_settings : regles automatiques par utilisateur,
--     routeur et profil (seuil 50, generation 120, frequence 15 min) ;
--   - internal_nonces : memoire anti-rejeu des appels internes signes ;
--   - ticket_generation_runs : colonnes simulation + debut d'execution.
-- Les mots de passe des tickets ne sont JAMAIS stockes : ils vivent dans
-- /ip/hotspot/user. Les secrets (Mikhmon, RouterOS, Telegram, WhatsApp,
-- PrintNode) restent chiffres en AES-256-GCM dans les tables existantes.
-- Correspondance des noms demandes :
--   router_connections / mikhmon_connections -> configurations_routeurs
--   telegram_bots      -> configurations_telegram
--   whatsapp_destinations -> configurations_whatsapp
--   printnode_destinations -> configurations_printnode
-- Des vues de compatibilite exposent ces noms en lecture seule.

-- 1) Profils Hotspot valides par espace et par connexion routeur.
CREATE TABLE IF NOT EXISTS hotspot_profiles (
  id                    bigserial   PRIMARY KEY,
  tenant_id             text        NOT NULL REFERENCES espaces(tenant_id)
                                      ON DELETE CASCADE,
  utilisateur_id        text        NOT NULL,
  router_connection_id  bigint      NOT NULL
                                      REFERENCES configurations_routeurs(id)
                                      ON DELETE CASCADE,
  nom                   text        NOT NULL,
  duree_limite          text, -- ex. "2h", NULL = sans limite
  volume_limite_octets  bigint, -- NULL = sans limite
  valide                boolean     NOT NULL DEFAULT false,
  actif                 boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, router_connection_id, nom)
);
CREATE INDEX IF NOT EXISTS idx_profils_tenant
  ON hotspot_profiles (tenant_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hotspot_profiles_nom_valide'
  ) THEN
    ALTER TABLE hotspot_profiles
      ADD CONSTRAINT hotspot_profiles_nom_valide
      CHECK (nom <> '' AND char_length(nom) <= 64);
  END IF;
END $$;

-- 2) Reglages de reapprovisionnement : UNE ligne par (espace, routeur,
-- profil). La contrainte UNIQUE est le verrou anti-doublon logique :
-- jamais deux regles actives pour le meme triplet.
CREATE TABLE IF NOT EXISTS auto_replenishment_settings (
  id                    bigserial   PRIMARY KEY,
  tenant_id             text        NOT NULL REFERENCES espaces(tenant_id)
                                      ON DELETE CASCADE,
  utilisateur_id        text        NOT NULL,
  router_connection_id  bigint      NOT NULL
                                      REFERENCES configurations_routeurs(id)
                                      ON DELETE CASCADE,
  mikhmon_connection_id bigint      REFERENCES configurations_routeurs(id)
                                      ON DELETE SET NULL,
  profile_id            bigint      REFERENCES hotspot_profiles(id)
                                      ON DELETE SET NULL,
  profil                text        NOT NULL,
  seuil                 integer     NOT NULL DEFAULT 50,
  quantite_generation   integer     NOT NULL DEFAULT 120,
  quantite_cible        integer     NOT NULL DEFAULT 120,
  frequence_minutes     integer     NOT NULL DEFAULT 15,
  canal                 text        NOT NULL DEFAULT 'telechargement',
  destinataire          text        NOT NULL DEFAULT '',
  duree_limite          text,
  volume_limite_octets  bigint,
  -- Tant que faux, AUCUNE generation automatique n'est possible.
  actif                 boolean     NOT NULL DEFAULT false,
  -- Passe vrai quand un cycle simulation a reussi de bout en bout.
  simulation_reussie    boolean     NOT NULL DEFAULT false,
  -- Hysteresis : apres un succes, faux jusqu'a ce que le stock repasse
  -- AU-DESSUS du seuil. Empeche la repetition permanente sous le seuil.
  stock_rearme          boolean     NOT NULL DEFAULT true,
  dernier_stock         integer,
  derniere_verif_le     timestamptz,
  derniere_erreur       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, router_connection_id, profil)
);
CREATE INDEX IF NOT EXISTS idx_reappro_tenant_actif
  ON auto_replenishment_settings (tenant_id, actif);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auto_reappro_quantites_valides'
  ) THEN
    ALTER TABLE auto_replenishment_settings
      ADD CONSTRAINT auto_reappro_quantites_valides
      CHECK (seuil >= 0 AND seuil <= 10000
        AND quantite_generation > 0 AND quantite_generation <= 500
        AND quantite_cible > 0 AND quantite_cible <= 500
        AND frequence_minutes >= 1 AND frequence_minutes <= 1440);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auto_reappro_canal_valide'
  ) THEN
    ALTER TABLE auto_replenishment_settings
      ADD CONSTRAINT auto_reappro_canal_valide
      CHECK (canal IN
        ('telegram', 'whatsapp', 'printnode', 'telechargement'));
  END IF;
END $$;

-- 3) Memoire anti-rejeu : une signature deja vue est rejetee.
CREATE TABLE IF NOT EXISTS internal_nonces (
  cle       text        PRIMARY KEY, -- signature HMAC hexadécimale
  recu_le   timestamptz NOT NULL DEFAULT now()
);

-- 4) Runs : rappel du mode simulation et du debut d'execution.
ALTER TABLE ticket_generation_runs
  ADD COLUMN IF NOT EXISTS simulation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demarre_le timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ticket_runs_statut_valide'
  ) THEN
    ALTER TABLE ticket_generation_runs
      ADD CONSTRAINT ticket_runs_statut_valide
      CHECK (statut IN
        ('demande', 'en_cours', 'simulation', 'termine', 'echoue'));
  END IF;
END $$;

-- 5) Vues de compatibilite : les noms canoniques en lecture seule.
-- Chaque vue expose user_id ET tenant_id : isolation par espace.
CREATE OR REPLACE VIEW router_connections AS
  SELECT id, tenant_id, tenant_id AS user_id, utilisateur_id,
    nom, adresse_routeros, utilisateur_lecture, utilisateur_correction,
    statut_connexion, actif, created_at
  FROM configurations_routeurs;

CREATE OR REPLACE VIEW mikhmon_connections AS
  SELECT id, tenant_id, tenant_id AS user_id, utilisateur_id,
    nom, variante_mikhmon, url_mikhmon, hote, port, identifiant_mikhmon,
    role, serveur_hotspot, mikhmon_change_requis,
    statut_connexion, actif, created_at
  FROM configurations_routeurs;

CREATE OR REPLACE VIEW telegram_bots AS
  SELECT id, tenant_id, tenant_id AS user_id, utilisateur_id,
    mode, nom, chat_id, nom_bot, bot_verifie,
    statut_connexion, created_at
  FROM configurations_telegram;

CREATE OR REPLACE VIEW whatsapp_destinations AS
  SELECT id, tenant_id, tenant_id AS user_id, utilisateur_id,
    webhook_url, destinataire_defaut, actif,
    statut_connexion, created_at
  FROM configurations_whatsapp;

CREATE OR REPLACE VIEW printnode_destinations AS
  SELECT id, tenant_id, tenant_id AS user_id, utilisateur_id,
    printer_id, nom_imprimante, format_papier, actif,
    statut_connexion, created_at
  FROM configurations_printnode;
