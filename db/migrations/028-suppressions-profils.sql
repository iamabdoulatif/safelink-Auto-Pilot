-- Journal des suppressions de profils Hotspot demandées depuis le
-- dashboard : plan exact affiché, approbation humaine, sauvegarde
-- routeur préalable, filet de restauration, résultat vérifié.
-- Côté RouterOS, rien n'est supprimé : le profil et ses tickets sont
-- désactivés (disabled=yes), réactivables à la main. La règle SaaS et
-- sa fiche profil, elles, sont supprimées après succès.
CREATE TABLE IF NOT EXISTS suppressions_profils (
  id                    bigserial   PRIMARY KEY,
  tenant_id             text        NOT NULL REFERENCES espaces(tenant_id)
                                  ON DELETE CASCADE,
  router_connection_id  bigint      NOT NULL,
  profil                text        NOT NULL,
  plan                  jsonb       NOT NULL,
  sauvegarde_nom        text,
  approuve_par          text        NOT NULL,
  statut                text        NOT NULL DEFAULT 'en-cours',
  tickets_desactives    integer,
  resultat              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  termine_le            timestamptz
);
CREATE INDEX IF NOT EXISTS idx_suppressions_profils_tenant
  ON suppressions_profils (tenant_id, created_at DESC);
