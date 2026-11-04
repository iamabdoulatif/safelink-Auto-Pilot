-- 002 : mode multi-utilisateur.
-- Chaque ligne appartient a un espace (tenant_id) et a un utilisateur
-- (utilisateur_id). Toute lecture filtre sur tenant_id : un utilisateur ne
-- voit jamais les routeurs, identifiants ni bots d'un autre espace.
-- Les secrets sont chiffres cote application (AES-256-GCM) : la base ne
-- contient que des textes opaques "v1:...". Les mots de passe des tickets
-- Hotspot ne sont JAMAIS stockes ici : ils vivent dans /ip/hotspot/user.

-- 1) Espaces : une ligne par utilisateur connecte (userId ou tenantId).
CREATE TABLE IF NOT EXISTS espaces (
  tenant_id     text        PRIMARY KEY, -- ex. adresse courriel normalisee
  utilisateur_id text       NOT NULL,
  affichage     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2) Configurations routeur : un espace peut gerer plusieurs routeurs,
-- un nom unique par espace.
CREATE TABLE IF NOT EXISTS configurations_routeurs (
  id                    bigserial   PRIMARY KEY,
  tenant_id             text        NOT NULL REFERENCES espaces(tenant_id)
                                  ON DELETE CASCADE,
  utilisateur_id        text        NOT NULL,
  nom                   text        NOT NULL,
  variante_mikhmon      text        NOT NULL DEFAULT 'v3', -- v3 | sf-v1
  url_mikhmon           text        NOT NULL,
  identifiant_mikhmon   text        NOT NULL,
  -- Secrets chiffres (AES-256-GCM, format "v1:..."), jamais en clair.
  mot_de_passe_mikhmon_chiffre      text NOT NULL,
  adresse_routeros      text        NOT NULL,
  utilisateur_lecture   text        NOT NULL,
  utilisateur_correction text       NOT NULL,
  mot_de_passe_correction_chiffre   text NOT NULL,
  -- Tant que vrai, l'enregistrement est refuse : le mot de passe initial
  -- Mikhmon (mikhmon / 1234) doit etre change a la premiere connexion.
  mikhmon_change_requis boolean    NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nom)
);
CREATE INDEX IF NOT EXISTS idx_config_routeurs_tenant
  ON configurations_routeurs (tenant_id);

-- 3) Configuration Telegram : une seule par espace (un bot central ou
-- un bot personnalise). Le jeton est chiffre et n'est jamais renvoye
-- au navigateur ni journalise.
CREATE TABLE IF NOT EXISTS configurations_telegram (
  id                bigserial   PRIMARY KEY,
  tenant_id         text        NOT NULL UNIQUE REFERENCES espaces(tenant_id)
                                ON DELETE CASCADE,
  utilisateur_id    text        NOT NULL,
  mode              text        NOT NULL DEFAULT 'central', -- central | personnalise
  chat_id           text        NOT NULL,
  jeton_chiffre     text, -- NULL en mode central (le jeton vit dans l'env)
  nom_bot           text, -- renseigne en mode personnalise, verifie via getMe
  bot_verifie       boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 4) Tables existantes : rattachement a l'espace.
ALTER TABLE routeurs
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'defaut';
CREATE INDEX IF NOT EXISTS idx_routeurs_tenant ON routeurs (tenant_id);

ALTER TABLE lots_tickets
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'defaut',
  ADD COLUMN IF NOT EXISTS cle_idempotence text,
  ADD COLUMN IF NOT EXISTS duree_limite text, -- ex. "2h", NULL = sans limite
  ADD COLUMN IF NOT EXISTS volume_limite_octets bigint; -- NULL = sans limite
-- Canal : interface | telegram | pdf (anciennes valeurs reste lisibles).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lots_tickets_cle_unique'
  ) THEN
    ALTER TABLE lots_tickets
      ADD CONSTRAINT lots_tickets_cle_unique UNIQUE (cle_idempotence);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_lots_tenant ON lots_tickets (tenant_id);

ALTER TABLE abonnements_tickets
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'defaut';
CREATE INDEX IF NOT EXISTS idx_abos_tenant ON abonnements_tickets (tenant_id);

ALTER TABLE executions_n8n
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'defaut';
CREATE INDEX IF NOT EXISTS idx_execs_tenant ON executions_n8n (tenant_id);

-- 5) Memoire anti-doublon : (source, cle_unique) reste la garde
-- d'idempotence des retours n8n (runId ou cle_idempotence).
