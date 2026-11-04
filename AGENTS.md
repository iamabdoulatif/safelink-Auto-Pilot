# Regles du projet — Autopilot MikroTik

## Qui je suis
Developpeur fullstack debutant, je travaille en francais.
Explique chaque fichier que tu crees en 2 lignes maximum.
Si une notion est nouvelle pour moi, dis-le en une phrase avant le code.
## Ce que fait l'application
Surveiller des routeurs MikroTik (diagnostic materiel, Wi-Fi, ports, audit de
configuration), corriger les problemes de CONFIGURATION apres validation, et
piloter la generation de tickets Hotspot via un workflow n8n.
## Stack imposee
- Next.js 16 (App Router) + TypeScript strict. Jamais de `any`.
- Tailwind CSS + composants shadcn/ui. JAMAIS de composant maison quand un
composant shadcn existe : cherche d'abord dans le registre.
- PostgreSQL via le paquet `pg`. SQL ecrit a la main, pas d'ORM sans me demander.
- Node.js runtime par defaut : en Next.js 16, ne mets PAS
`export const runtime = "nodejs"` (c'est le defaut, Edge est deprecie).
- Avant d'ecrire du code Next.js, verifie l'API dans node_modules/next/dist/docs/.
## Conventions
- Fichiers en kebab-case (ex: diagnostic-carte.tsx).
- Tout le code reseau vers le routeur passe par lib/routeros.ts. Un seul client.
- Les textes d'interface, les commentaires et les messages d'erreur : FRANCAIS.
- Les montants et les durees : jamais de nombre flottant pour une valeur exacte.
- Chaque route d'API renvoie { data } ou { error }, jamais autre chose.
## Securite
- Les secrets vivent dans .env.local, lus cote serveur uniquement.
- Aucun secret derriere NEXT_PUBLIC_.
- Le diagnostic utilise le compte ROUTEROS_USER (lecture seule).
Toute ecriture sur le routeur utilise ROUTEROS_FIX_USER, et seulement apres
validation humaine : voir le skill routeros-autofix.
- Les mots de passe des tickets Hotspot ne sont jamais stockes en base ni
journalises : ils vivent dans le routeur.
- Tout webhook entrant est verifie (signature) et idempotent.
## Interdits
- Ne jamais ecrire sur un routeur sans sauvegarde prealable et plan approuve.
- Ne jamais toucher aux regles input du pare-feu, a /ip/service, a l'adressage
IP ou aux routes de facon automatique : proposer, ne pas appliquer.
- Ne jamais supprimer un objet RouterOS : desactiver (disabled=yes).
- Ne jamais faire dependre l'application d'un serveur MCP. Le MCP est un outil
d'atelier ; le code livre parle au routeur en REST via lib/routeros.ts.
- Ne jamais installer une dependance lourde sans me demander d'abord.
- Ne jamais supprimer un fichier sans confirmation.
## Facon de travailler