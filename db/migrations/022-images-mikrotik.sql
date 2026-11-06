-- Catalogue officiel MikroTik : une ligne par photographie de galerie.
-- L'image affichée (_lg.webp) est stockée en base ; les URL des autres
-- variantes (miniature, XL, haute résolution) sont conservées pour
-- pouvoir les récupérer sans relire la page produit.
CREATE TABLE IF NOT EXISTS images_mikrotik (
  id                   bigserial PRIMARY KEY,
  slug                 text        NOT NULL,
  nom_produit          text        NOT NULL,
  cle_nom              text        NOT NULL,
  code_produit         text,
  url_page             text        NOT NULL,
  identifiant_image    text        NOT NULL,
  position             integer     NOT NULL DEFAULT 0,
  url_source           text        NOT NULL,
  url_miniature        text,
  url_grande           text,
  url_haute_resolution text,
  donnees              bytea       NOT NULL,
  type_mime            text        NOT NULL,
  taille_octets        integer     NOT NULL CHECK (taille_octets >= 0),
  empreinte_sha256     text        NOT NULL,
  cree_le              timestamptz NOT NULL DEFAULT now(),
  maj_le               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, identifiant_image)
);

CREATE INDEX IF NOT EXISTS idx_images_mikrotik_slug
  ON images_mikrotik (slug);
CREATE INDEX IF NOT EXISTS idx_images_mikrotik_code
  ON images_mikrotik (code_produit);
CREATE INDEX IF NOT EXISTS idx_images_mikrotik_nom
  ON images_mikrotik (cle_nom);
