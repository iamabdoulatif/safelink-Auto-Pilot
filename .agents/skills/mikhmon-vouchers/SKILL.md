---
name: mikhmon-vouchers
description: >
  A utiliser pour tout ce qui touche aux tickets Wi-Fi Hotspot MikroTik et a
  Mikhmon : generer des vouchers, compter le stock disponible par profil,
  nommer et formater les codes, poser des limites de duree ou de volume,
  imprimer ou envoyer les tickets, et comprendre la cohabitation entre
  Mikhmon, le routeur et une application tierce.
---

# Tickets Hotspot (vouchers) et Mikhmon

## Ce qu'il faut comprendre avant tout
Mikhmon ne stocke RIEN. C'est une interface PHP posee devant le routeur : les
tickets vivent dans /ip/hotspot/user, sur le routeur, et nulle part ailleurs.
Consequence pratique : une application ou un workflow qui ecrit directement
dans /ip/hotspot/user est immediatement visible dans Mikhmon, et inversement.
Il n'y a pas de synchronisation a ecrire. C'est la source unique de verite.

## Vocabulaire exact
| Terme           | Realite technique                                       |
|-----------------|---------------------------------------------------------|
| Ticket/voucher  | une entree de /ip/hotspot/user (name + password)        |
| Profil          | /ip/hotspot/user/profile : duree, debit, clients simult. |
| Serveur hotspot | /ip/hotspot : l'instance liee a une interface           |
| Ticket "neuf"   | disabled=no ET uptime a 0s : jamais utilise             |
| Stock           | nombre de tickets neufs pour un profil donne            |

## Compter le stock (la seule definition acceptable)
GET /rest/ip/hotspot/user, puis filtrer : meme profil, disabled != true,
uptime == "0s". Un ticket deja utilise n'est PAS du stock, meme s'il reste du
temps dessus. Un ticket desactive non plus.

## Generer un lot
- Alphabet sans ambiguite : 23456789abcdefghijkmnpqrstuvwxyz (pas de 0/0/1/l).
- Longueur 4 a 6 pour un ticket papier ; plus long = erreurs de saisie.
- Ecrire un ticket = PUT /rest/ip/hotspot/user avec name, password, profile,
  server, comment. Le commentaire porte la tracabilite : outil + horodatage.
- Limites optionnelles : limit-uptime (duree) et limit-bytes-total (volume).
- Un ticket par appel. Si un appel echoue au milieu d'un lot : s'arreter,
  rendre compte du nombre reellement cree. Ne jamais rejouer un lot entier.

## Securite des tickets
- Le mot de passe d'un ticket est un secret de faible valeur mais c'est un
  secret : ne pas l'ecrire dans les journaux, ne pas le mettre dans une URL.
- Ne pas dupliquer les mots de passe dans une base applicative : ils sont deja
  dans le routeur. Stocker le lot, le profil, la quantite, pas les secrets.
  Pour reimprimer, relire le routeur.
- Un compte RouterOS dedie (n8n-vouchers), limite au hotspot.

## Seuils et automatisation
- Seuil de reapprovisionnement : regenerer quand le stock passe sous N.
- Toujours borner la quantite par appel (ex. 1 a 500) : une erreur de saisie
  ne doit pas creer 50 000 utilisateurs sur un routeur a 128 Mo de RAM.
- Un hotspot avec des dizaines de milliers d'utilisateurs ralentit le routeur :
  prevoir le nettoyage des tickets expires (desactiver, puis supprimer apres
  une periode de grace).

## Mikhmon V3 et SF v1
Deux variantes en circulation, memes concepts, URL d'administration et details
d'interface differents. Le code qui parle au routeur est identique : garder la
variante et l'URL de base dans des variables d'environnement (MIKHMON_VARIANT,
MIKHMON_BASE_URL) et ne jamais coder l'une des deux en dur.

## A ne jamais faire
- Ne jamais compter le stock sur le total des utilisateurs du profil.
- Ne jamais generer des tickets sans profil explicite.
- Ne jamais afficher un lot de tickets sans dire combien ont ete reellement crees.
