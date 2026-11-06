-- Membres d'un espace et leurs rôles : admin (gère tout), contributeur
-- (génère et envoie), utilisateur (consulte). Le créateur de l'espace
-- est admin ; les autres sont invités par un admin.
CREATE TABLE IF NOT EXISTS membres_espace (
  tenant_id  text        NOT NULL REFERENCES espaces(tenant_id) ON DELETE CASCADE,
  courriel   text        NOT NULL,
  role       text        NOT NULL CHECK (role IN ('admin', 'contributeur', 'utilisateur')),
  invite_par text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, courriel)
);
CREATE INDEX IF NOT EXISTS idx_membres_espace_courriel
  ON membres_espace (courriel);

-- Les espaces existants : leur propriétaire devient admin.
INSERT INTO membres_espace (tenant_id, courriel, role)
SELECT tenant_id, utilisateur_id, 'admin' FROM espaces
ON CONFLICT DO NOTHING;
