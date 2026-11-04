-- Abonnements a la generation automatique de tickets.
-- Un routeur + un profil = un abonnement : seuil de stock, canal d'envoi
-- et destinataire. La ronde (POST /api/tickets/auto) lit cette table.
CREATE TABLE IF NOT EXISTS abonnements_tickets (
  id            serial      PRIMARY KEY,
  routeur_id    integer     NOT NULL REFERENCES routeurs(id) ON DELETE CASCADE,
  profil        text        NOT NULL,
  seuil         integer     NOT NULL DEFAULT 50, -- regenerer sous ce stock (0 = pause)
  canal         text        NOT NULL DEFAULT 'telegram', -- telegram | whatsapp | printnode
  destinataire  text        NOT NULL, -- chat, numero ou file d'impression
  actif         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routeur_id, profil)
);
