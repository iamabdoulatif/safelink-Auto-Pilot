// Alias serveur du chiffrement : l'implementation UNIQUE (AES-256-GCM via
// node:crypto, cle CHIFFREMENT_CLE cote serveur) vit dans ./chiffrement.
// Ce module existe pour le nommage demande sans dupliquer la logique.
// Ne jamais journaliser ni renvoyer un secret en clair.
export { chiffrer, dechiffrer, secretMasque } from "./chiffrement";
