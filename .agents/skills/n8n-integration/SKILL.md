---
name: n8n-integration
description: >
  A utiliser pour tout ce qui relie l'application a n8n : lire ou modifier un
  workflow au format JSON, ajouter un node, declencher un workflow depuis
  l'application, recevoir un retour de n8n (callback signe et idempotent),
  gerer une approbation humaine avec un node Wait, et nommer les variables
  d'environnement de n8n. A charger des que n8n, un webhook ou un workflow
  est mentionne.
---

# Brancher n8n a une application Next.js

## Regle d'or
n8n et l'application sont deux programmes. Chaque sens d'echange doit etre
authentifie, journalise et rejouable sans degat. Un webhook sans secret est
une porte ouverte ; un webhook sans idempotence est un doublon qui attend.

## Les trois branchements, et pas un de plus
| Sens          | Qui appelle qui        | A proteger par         |
|---------------|------------------------|------------------------|
| Declenchement | app -> webhook n8n     | en-tete secret partage |
| Compte rendu  | n8n -> /api/n8n/callback | signature HMAC + runId |
| Approbation   | app -> resumeUrl n8n   | jeton a usage unique   |

## Modifier un workflow JSON : les 5 regles
1. Ne jamais reecrire un workflow entier : ajouter/modifier le node voulu et
   la connexion correspondante dans "connections".
2. Un node = un objet avec parameters, id, name, type, typeVersion, position.
   Copier typeVersion depuis un node du MEME type deja present dans le fichier :
   une typeVersion inventee casse l'import.
3. "connections" est indexe par le NOM du node, pas par son id. Renommer un
   node oblige a mettre a jour toutes ses connexions.
4. Les ids doivent rester uniques dans le fichier.
5. Apres modification : reimporter dans n8n et executer une fois a vide. Un
   JSON valide n'est pas un workflow valide.

## Webhook de test et webhook de production
n8n expose DEUX URL par node Webhook : /webhook-test/... (active uniquement
quand l'editeur ecoute, pour un seul appel) et /webhook/... (active quand le
workflow est "Active"). L'application utilise toujours la seconde. Un workflow
jamais active renvoie 404 : c'est la cause n.1 des "mon webhook ne marche pas".

## Recevoir un retour de n8n : la sequence obligatoire
1. Verifier la signature (HMAC-SHA256 du corps brut avec un secret partage) ;
   sinon 401 et on s'arrete.
2. Verifier l'idempotence sur l'identifiant d'execution : deja traite ->
   repondre 200 sans rien refaire.
3. Traiter. 4. Repondre 200 vite. Le travail long se fait apres la reponse.

## Approbation humaine
Le node Wait en mode "webhook" expose $execution.resumeUrl : une URL qui
reprend l'execution la ou elle s'est arretee. Cette URL est un secret a usage
unique. Elle peut etre envoyee dans un message (Telegram) OU remise a
l'application, qui affiche un ecran d'approbation et l'appelle a la validation.
La seconde option est preferable : la decision reste dans l'application, avec
son journal et son controle d'acces.

## Variables d'environnement
Toutes les valeurs variables d'un workflow passent par $env, jamais en dur
dans un node Code. Les nommer en MAJUSCULES_AVEC_UNDERSCORES et les declarer
dans le docker-compose de n8n. Un workflow exporte ne doit contenir aucun
secret : c'est ce qui permet de le committer.

## A ne jamais faire
- Ne jamais exposer un webhook n8n sur Internet sans authentification.
- Ne jamais faire confiance au corps d'un webhook : le valider comme une
  entree utilisateur.
- Ne jamais stocker un secret dans un node Code ou dans le nom d'un node.
- Ne jamais laisser un workflow d'ecriture en "Active" pendant les essais :
  le declencheur periodique tournera sans que vous regardiez.
