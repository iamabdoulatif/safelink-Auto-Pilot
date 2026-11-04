-- 006 : suivi des generations de tickets (runs) et reglages par espace.
--
-- ticket_generation_runs : une ligne par runId. Le couple
-- (tenant_id, run_id) est UNIQUE : rejouer le meme runId retrouve la
-- ligne au lieu d'en creer une (idempotence, meme garantie que
-- webhooks_recus pour n8n). Les mots de passe des tickets ne sont
-- JAMAIS stockes ici : seuls le profil, les quantites et les statuts
-- sont conserves, les secrets vivent dans /ip/hotspot/user.
-- Quantites et durees : INTEGER / BIGINT uniquement, jamais de flottant.
--
-- ticket_generation_settings : une ligne par espace (tenant), les
-- valeurs proposees par defaut dans le formulaire de generation.

CREATE TABLE IF NOT EXISTS ticket_generation_runs (
  id                    bigserial   PRIMARY KEY,
  run_id                text        NOT NULL,
  tenant_id             text        NOT NULL REFERENCES espaces(tenant_id)
                                      ON DELETE CASCADE,
  utilisateur_id        text        NOT NULL,
  mikhmon_connection_id bigint      REFERENCES configurations_routeurs(id)
                                      ON DELETE SET NULL,
  router_connection_id  bigint      REFERENCES configurations_routeurs(id)
                                      ON DELETE SET NULL,
  profil                text        NOT NULL,
  quantite_demandee     integer     NOT NULL CHECK (quantite_demandee > 0),
  quantite_creee        integer     NOT NULL DEFAULT 0
                                      CHECK (quantite_creee >= 0),
  canal_envoi           text        NOT NULL DEFAULT 'interface',
  telegram_chat_id      text,
  statut                text        NOT NULL DEFAULT 'demande',
  erreur                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  termine_le            timestamptz,
  UNIQUE (tenant_id, run_id)
);
CREATE INDEX IF NOT EXISTS idx_runs_tenant_date
  ON ticket_generation_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_generation_settings (
  tenant_id             text        PRIMARY KEY REFERENCES espaces(tenant_id)
                                      ON DELETE CASCADE,
  utilisateur_id        text        NOT NULL,
  profil_defaut         text,
  quantite_defaut       integer     NOT NULL DEFAULT 10
                                      CHECK (quantite_defaut > 0),
  canal_defaut          text        NOT NULL DEFAULT 'interface',
  mikhmon_connection_id bigint      REFERENCES configurations_routeurs(id)
                                      ON DELETE SET NULL,
  router_connection_id  bigint      REFERENCES configurations_routeurs(id)
                                      ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
