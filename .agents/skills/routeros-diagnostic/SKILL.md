---
name: routeros-diagnostic
description: >
  A utiliser lorsque la tache parle de panne, de signal, de port,
  de Wi-Fi, de temperature ou de coupure sur MikroTik RouterOS 7.
---

# Diagnostic RouterOS 7

## Regle d'or
Compare deux releves espaces, jamais une seule mesure.
Interprete une variation, jamais un compteur cumule brut.

## Collecte
Lis en GET chaque chemin, stocke le JSON brut sans trier.
Utilise .proplist pour alleger, .query pour filtrer si besoin.
| Domaine | Chemin REST | Ce que tu en tires |
|---|---|---|
| Identite | /rest/system/identity, /rest/system/routerboard | modele, version, firmware |
| Charge | /rest/system/resource | CPU, memoire, uptime |
| Sante | /rest/system/health | temperature, tension, ventilateur |
| Interfaces | /rest/interface | running, link-downs, erreurs |
| Ethernet | /rest/interface/ethernet | vitesse, duplex, negociation |
| Wi-Fi neuf | /rest/interface/wifi, .../registration-table | canal, bruit, clients, signal |
| Wi-Fi ancien | /rest/interface/wireless, .../registration-table | signal, CCQ, SNR |
| Journal | /rest/log | redemarrages, erreurs materielles |

## Pilote Wi-Fi
Sonde /rest/interface/wifi en premier, puis /rest/interface/wireless.
Retiens celui qui repond, ignore l'autre pour toute l'analyse.
Si aucun ne repond alors que la carte existe, conclus radio non detectee.

## Seuils
Compare chaque mesure a ce tableau, pas a ton intuition.
| Mesure | Bon | A surveiller | Mauvais |
|---|---|---|---|
| Signal client | > -65 dBm | -65 a -75 dBm | < -75 dBm |
| Bruit | < -90 dBm | -90 a -80 dBm | > -80 dBm |
| SNR | > 25 dB | 15 a 25 dB | < 15 dB |
| CCQ | > 80 % | 60 a 80 % | < 60 % |
| CPU soutenu | < 60 % | 60 a 85 % | > 85 % |
| Memoire libre | > 25 % | 10 a 25 % | < 10 % |
| Temperature | < 60 C | 60 a 70 C | > 70 C |
| Erreurs FCS/min | 0 | 1 a 10 | > 10 |
| Link-downs/24h | 0 a 1 | 2 a 5 | > 5 |

## Classement
Classe chaque constat dans une seule categorie.
Configuration : corrige par API, parametre absent ou dangereux.
Materiel : suspecte seulement sur mesure physique anormale repetee.
Environnement : retiens bruit, distance, saturation, cable trop long.

## A ne jamais faire
Ne conclus jamais materiel hors service sur une seule mesure.
Ne conclus jamais sur un pourcentage sans duree de mesure.
Ne modifie jamais le routeur depuis un diagnostic, reste en lecture seule.
N'invente jamais un nom de champ, signale-le comme indisponible.
Ne demande jamais un mot de passe admin pour diagnostiquer.
