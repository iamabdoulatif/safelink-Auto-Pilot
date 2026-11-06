-- Rapport des ventes par zone Wi-Fi (Mikhmon SF) : l'utilisateur
-- planifie l'envoi (cycles de 00h à 00h : décade du 1er au 10,
-- du 11 au 20, du 21 à la fin du mois ; hebdomadaire ; mensuel ;
-- ou période personnalisée), définis dans le dashboard,
-- choisit le canal (WhatsApp ou Telegram), et le workflow n8n calcule
-- les ventes de la période sur RouterOS puis envoie le point au
-- gérant, à l'admin et aux vendeurs de la zone.
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_actif boolean NOT NULL DEFAULT false;
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_canal text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_planification text NOT NULL DEFAULT 'mensuel';
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_debut date;
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_fin date;
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS rapport_date_envoi date;
ALTER TABLE zones_wifi_destinataires
  ADD COLUMN IF NOT EXISTS dernier_rapport_le timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zones_wifi_rapport_canal_valide'
  ) THEN
    ALTER TABLE zones_wifi_destinataires
      ADD CONSTRAINT zones_wifi_rapport_canal_valide
      CHECK (rapport_canal IN ('telegram', 'whatsapp'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zones_wifi_rapport_planification_valide'
  ) THEN
    ALTER TABLE zones_wifi_destinataires
      ADD CONSTRAINT zones_wifi_rapport_planification_valide
      CHECK (rapport_planification IN ('decade', 'hebdomadaire', 'mensuel', 'personnalise'));
  END IF;
END $$;

-- Un envoi de rapport par zone et par période : la contrainte
-- d'unicité empêche tout double envoi si le cycle se répète.
CREATE TABLE IF NOT EXISTS rapports_ventes_envois (
  rapport_id    text        PRIMARY KEY,
  tenant_id     text        NOT NULL REFERENCES espaces(tenant_id)
                              ON DELETE CASCADE,
  router_connection_id bigint NOT NULL
                              REFERENCES configurations_routeurs(id)
                              ON DELETE CASCADE,
  periode_debut date        NOT NULL,
  periode_fin   date        NOT NULL,
  canal         text        NOT NULL,
  statut        text        NOT NULL DEFAULT 'demande',
  total_vendu   integer,
  tickets_vendus integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  envoye_le     timestamptz,
  UNIQUE (tenant_id, router_connection_id, periode_debut, periode_fin)
);
CREATE INDEX IF NOT EXISTS idx_rapports_ventes_tenant
  ON rapports_ventes_envois (tenant_id);
