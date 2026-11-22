-- Liaison SafeLinkHub (même VPS) : jeton chiffré obtenu en échangeant un
-- code de liaison généré dans SafeLinkHub → Réglages → Avancé. Sert à
-- importer les routeurs déjà joignables par le tunnel WireGuard de
-- SafeLinkHub, sans second tunnel sur les routeurs. Une liaison par espace.
CREATE TABLE IF NOT EXISTS liaisons_safelinkhub (
  tenant_id     text        PRIMARY KEY REFERENCES espaces(tenant_id) ON DELETE CASCADE,
  jeton_chiffre text        NOT NULL,
  organisation  text        NOT NULL,
  lie_le        timestamptz NOT NULL DEFAULT now()
);
