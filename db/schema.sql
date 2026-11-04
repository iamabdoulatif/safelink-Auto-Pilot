-- Autopilot MikroTik - schema initial.
-- Regles suivies : tables au pluriel en snake_case, id technique, cle etrangere
-- avec contrainte ET index, created_at systematique, pas de flottant pour une
-- valeur exacte, statut enumere plutot que plusieurs booleens.

-- 1) Le parc
CREATE TABLE IF NOT EXISTS routeurs (
  id          serial PRIMARY KEY,
  nom         text        NOT NULL,              -- "Site A - salle serveur"
  url_base    text        NOT NULL,              -- https://192.168.88.1
  modele      text,                              -- renseigne par la collecte
  version_os  text,
  actif       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2) Les releves : le JSON BRUT, tel que le routeur l'a renvoye
-- On ne jette rien : les champs disponibles varient selon modele et version,
-- et une regle de diagnostic ecrite demain voudra relire les releves d'hier.
CREATE TABLE IF NOT EXISTS releves (
  id          bigserial   PRIMARY KEY,
  routeur_id  integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  mesure_le   timestamptz NOT NULL DEFAULT now(),
  duree_ms    integer,                            -- temps de collecte
  statut      text        NOT NULL DEFAULT 'ok', -- ok | partiel | injoignable
  erreur      text,                              -- si injoignable : pourquoi
  donnees     jsonb       NOT NULL               -- { "system/resource": {...}, ... }
);
CREATE INDEX IF NOT EXISTS idx_releves_routeur_date ON releves (routeur_id, mesure_le DESC);

-- 3) Les compteurs extraits, pour calculer des variations
-- Une ligne par interface et par releve. On extrait ce dont les regles ont
-- besoin, le reste reste dans le JSON du releve.
CREATE TABLE IF NOT EXISTS mesures_interfaces (
  id              bigserial   PRIMARY KEY,
  releve_id       bigint      NOT NULL REFERENCES releves(id) ON DELETE CASCADE,
  routeur_id      integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  interface_nom   text        NOT NULL,
  mesure_le       timestamptz NOT NULL,
  en_service      boolean,
  vitesse         text,                             -- "1Gbps", "100Mbps"
  rx_erreurs      bigint,
  tx_erreurs      bigint,
  rx_rejets       bigint,
  tx_rejets       bigint,
  liens_perdus    integer,                          -- link-downs cumules
  rx_octets       bigint,
  tx_octets       bigint
);
CREATE INDEX IF NOT EXISTS idx_mesures_if ON mesures_interfaces (routeur_id, interface_nom, mesure_le DESC);

-- 4) Les clients Wi-Fi vus a un instant donne
CREATE TABLE IF NOT EXISTS mesures_wifi (
  id              bigserial   PRIMARY KEY,
  releve_id       bigint      NOT NULL REFERENCES releves(id) ON DELETE CASCADE,
  routeur_id      integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  mesure_le       timestamptz NOT NULL,
  interface_nom   text        NOT NULL,
  pilote          text        NOT NULL, -- 'wifi' | 'wireless'
  canal           text,
  bruit_dbm       integer,              -- noise floor
  clients         integer,
  signal_min_dbm  integer,
  signal_moy_dbm  integer,
  ccq_pct         integer               -- null avec le pilote recent
);
CREATE INDEX IF NOT EXISTS idx_mesures_wifi ON mesures_wifi (routeur_id, mesure_le DESC);

-- 5) Les constats : la sortie du diagnostic et de l'audit
CREATE TABLE IF NOT EXISTS constats (
  id            bigserial   PRIMARY KEY,
  routeur_id    integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  regle         text        NOT NULL,              -- 'port.fcs-croissant'
  categorie     text        NOT NULL,              -- configuration | materiel | environnement
  gravite       text        NOT NULL,              -- critique | majeure | mineure | information
  cible         text,                              -- 'ether3', 'wlan1', '/ip/dns'
  titre         text        NOT NULL,
  constat       text        NOT NULL,              -- la phrase avec les valeurs mesurees
  preuve        jsonb       NOT NULL,              -- les 2 mesures + le seuil
  correctif     jsonb,                             -- le plan d'appels REST, si reparable
  statut        text        NOT NULL DEFAULT 'ouvert', -- ouvert | corrige | ignore |
                                                     -- confirme_materiel
  premier_vu_le timestamptz NOT NULL DEFAULT now(),
  dernier_vu_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routeur_id, regle, cible) -- un constat ne se duplique pas
);
CREATE INDEX IF NOT EXISTS idx_constats_ouverts ON constats (routeur_id, statut, gravite);

-- 6) Les correctifs appliques : la tracabilite
CREATE TABLE IF NOT EXISTS correctifs (
  id              bigserial   PRIMARY KEY,
  constat_id      bigint      NOT NULL REFERENCES constats(id) ON DELETE CASCADE,
  routeur_id      integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  plan            jsonb       NOT NULL, -- ce qui devait partir
  sauvegarde_nom  text        NOT NULL, -- le backup d'avant
  approuve_par    text        NOT NULL,
  approuve_le     timestamptz NOT NULL,
  applique_le     timestamptz,
  resultat        jsonb,                 -- la reponse de chaque appel
  statut          text        NOT NULL DEFAULT 'approuve',
                                       -- approuve | applique | echoue | annule
  verifie         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_correctifs_routeur ON correctifs (routeur_id, created_at DESC);

-- 7) Les lots de tickets Hotspot (fonction 2)
-- Pas de mot de passe ici : il vit dans le routeur. On garde la tracabilite.
CREATE TABLE IF NOT EXISTS lots_tickets (
  id                  bigserial   PRIMARY KEY,
  routeur_id          integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  profil              text        NOT NULL,
  quantite_demandee   integer     NOT NULL,
  quantite_creee      integer     NOT NULL DEFAULT 0,
  prefixe             text,
  canal_envoi         text,                             -- telegram | whatsapp | printnode
  destinataire        text,
  statut              text        NOT NULL DEFAULT 'demande',
                                                       -- demande | en_attente_approbation | refuse | genere | echoue
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 8) Les executions n8n : qui a declenche quoi, et ou ca en est
CREATE TABLE IF NOT EXISTS executions_n8n (
  id            bigserial   PRIMARY KEY,
  lot_id        bigint      REFERENCES lots_tickets(id) ON DELETE SET NULL,
  workflow      text        NOT NULL, -- 'mikhmon-tickets'
  execution_id  text        UNIQUE,   -- l'id d'execution n8n : l'idempotence
  url_reprise   text,                 -- resumeUrl, si approbation
  statut        text        NOT NULL DEFAULT 'lance',
                                     -- lance | en_attente | termine | echoue
  charge_utile  jsonb,                -- ce que n8n a renvoye
  created_at    timestamptz NOT NULL DEFAULT now(),
  termine_le    timestamptz
);

-- 9) Les webhooks recus : la memoire anti-doublon
CREATE TABLE IF NOT EXISTS webhooks_recus (
  id          bigserial   PRIMARY KEY,
  source      text        NOT NULL, -- 'n8n'
  cle_unique  text        NOT NULL, -- execution_id ou id d'evenement
  recu_le     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, cle_unique)
);
