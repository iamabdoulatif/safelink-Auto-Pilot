-- Nom imprime en tete des tickets (equivalent du « hotspot name » de Mikhmon).
-- Vide : le nom du routeur est utilise.
ALTER TABLE configurations_routeurs ADD COLUMN IF NOT EXISTS nom_ticket TEXT;
