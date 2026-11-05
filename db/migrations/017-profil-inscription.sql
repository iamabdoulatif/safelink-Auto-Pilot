-- Profil demandé à l'inscription : nom, prénom, pays et numéro.
-- Colonnes nullable : les comptes créés avant cette migration n'ont
-- pas ces informations ; l'application les exige pour les nouveaux.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS nom text;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS prenom text;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS pays text;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS numero text;
