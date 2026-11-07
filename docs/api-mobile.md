# API mobile SafeLink Auto-Pilot (v1)

Base : `https://app.safelinkhub.io/api/mobile/v1`
Format partout : `{ "data": ... }` en succès, `{ "error": "..." }` en échec.
Aucun secret (mot de passe de ticket, jeton Telegram) ne transite.

## Authentification (jeton Bearer)

```http
POST /api/mobile/v1/auth/connexion
{ "courriel": "vous@exemple.ci", "motDePasse": "..." }
-> { "data": { "jeton": "...", "type": "Bearer",
               "expireDansSecondes": 2592000,
               "utilisateur": { "courriel": "...", "tenantId": "..." } } }
```

Ensuite, sur chaque appel : `Authorization: Bearer <jeton>`.
Jeton valable 30 jours. Un changement de mot de passe le révoque.
Sans jeton valide : `401 { "error": "Authentification requise." }`.

Déconnexion : le client efface le jeton (sans état côté serveur).

## Endpoints v1

| Méthode | Chemin | Réponse (data) |
|---|---|---|
| GET | `/sante` | `{ statut, api, version }` (public) |
| POST | `/auth/connexion` | jeton Bearer |
| GET | `/moi` | profil, espace, rôle (admin/gerant/vendeur) |
| GET | `/tableau-de-bord` | routeurs, zones, reglesActives, stockTotal, ticketsGeneres30j |
| GET | `/routeurs` | routeurs et zones (nom, variante Mikhmon, commune, coordonnées, nom Wi-Fi) |
| GET | `/regles` | règles de réapprovisionnement et leur état |
| GET | `/zones` | fiches zones complètes (destinataires, rapport, prix, géolocalisation) |
| GET | `/historique` | 20 dernières générations |
| GET | `/rapports` | 20 derniers rapports des ventes |

## Réutilisation des routes web existantes

Avec le même en-tête Bearer, l'application mobile peut aussi appeler
les routes déjà en production (mêmes contrats `{ data } / { error }`) :

- `POST /api/generer-tickets` (génération manuelle, confirmation en deux temps)
- `GET|POST /api/reapprovisionnement` (règles)
- `GET /api/historique`, `GET /api/configuration/whatsapp/zones`
- `POST /api/reapprovisionnement/suppression` (aperçu, admin)

## Versionnage

- Préfixe `/v1` figé : une v2 éventuelle vivra à côté, sans casser la v1.
- Ajouts de champs rétrocompatibles possibles en v1 ; jamais de
  renommage ni de suppression de champ en v1.
