-- Paramètres de la plateforme, réglés depuis l'espace superadmin :
-- lien du groupe communautaire et webhook d'envoi du code WhatsApp.
-- Le secret du webhook est stocké chiffré (AES-256-GCM), jamais en clair.
CREATE TABLE IF NOT EXISTS parametres_plateforme (
  cle        text PRIMARY KEY,
  valeur     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
