---
name: routeros-autofix
description: >
  A utiliser des qu'une tache doit MODIFIER la configuration d'un routeur
  MikroTik : appliquer un correctif, activer un service, ajouter une regle de
  pare-feu, corriger le DNS ou le NTP. Impose la procedure de sauvegarde, de
  plan, d'approbation, de verification et de retour arriere, et la liste des
  modifications interdites a l'automatisation.
---

# Appliquer un correctif sur un routeur, sans se couper la branche

## Regle d'or
Une ecriture sur un routeur distant peut vous enfermer dehors. Avant toute
ecriture : une sauvegarde, un plan lisible, une approbation humaine, et un
retour arriere deja arme. Dans cet ordre. Sans exception.

## Les 6 etapes, dans l'ordre
1. SAUVEGARDER
   POST /rest/system/backup/save   { "name": "avant-correctif-<horodatage>" }
   POST /rest/export               (export texte, stocke cote application)
2. PLANIFIER – produire le plan EXACT, affichable, de ce qui va partir :
   methode + chemin + corps JSON, une ligne par appel. Rien d'implicite.
3. ARMER LE RETOUR ARRIERE – avant d'ecrire, programmer sur le routeur une
   restauration differee. Si le correctif vous coupe l'acces, le routeur se
   remet seul.
   /system/scheduler/add name=filet start-time=startup interval=5m \
     on-event="/system/backup/load name=avant-correctif-<horodatage>"
   Puis, une fois l'acces reconfirme : supprimer le scheduler. S'il reste, le
   routeur annulera votre correctif : la suppression fait partie du correctif.
4. APPROUVER – un humain valide le plan dans l'interface. Pas de case
   pre-cochee, pas de "appliquer tout".
5. APPLIQUER – un appel a la fois, dans l'ordre du plan, en journalisant la
   reponse de chaque appel. Premier echec = arret immediat, pas de suite.
6. VERIFIER – relire la configuration et confirmer que l'etat attendu est la ;
   puis reverifier que le routeur repond toujours (c'est la vraie question).

## Interdit a l'automatisation (proposer, jamais appliquer seul)
- Les regles de /ip/firewall/filter en chaine input et /ip/service :
  c'est par la qu'on se coupe l'acces. Correctif propose, applique a la main.
- Tout changement d'adresse IP, de passerelle, de route par defaut, de bridge.
- La mise a jour de RouterOS ou du firmware RouterBOARD (redemarrage).
- La suppression de quoi que ce soit. On desactive (disabled=yes), on ne
  supprime pas : c'est reversible et ca laisse une trace.
- Les utilisateurs et les mots de passe.

## Toujours, techniquement
- Utiliser le compte d'ecriture dedie (app-fix), jamais admin, jamais app-audit.
- PUT = creer, PATCH = modifier, DELETE = supprimer. Verifier avant d'envoyer.
- Rendre chaque correctif idempotent : verifier si l'etat cible est deja la et
  ne rien envoyer dans ce cas.
- Journaliser en base : qui, quand, le plan, la reponse, le resultat verifie.

## Definition of Done
- [ ] Sauvegarde faite ET retrouvable avant la premiere ecriture.
- [ ] Plan affiche a l'humain, approuve explicitement, stocke en base.
- [ ] Filet de restauration arme avant, retire apres reconfirmation d'acces.
- [ ] Chaque appel journalise avec sa reponse.
- [ ] Verification post-correctif passee, et routeur toujours joignable.
- [ ] Un bouton "revenir en arriere" existe et a ete teste au moins une fois.
