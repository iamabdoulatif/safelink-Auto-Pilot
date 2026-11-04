# SafeLink Auto-Pilot

SafeLink Auto-Pilot est une application de supervision et d’automatisation de routeurs MikroTik. Elle centralise le diagnostic, l’audit de configuration et la génération contrôlée de tickets Hotspot.

Le projet sépare la connexion Mikhmon, la connexion RouterOS, les workflows n8n et les canaux de livraison Telegram, WhatsApp et imprimante.

## Fonctionnalités

- Gestion d’un parc de routeurs MikroTik.
- Diagnostic matériel, réseau, Wi-Fi et Hotspot.
- Audit de configuration RouterOS.
- Séparation entre compte RouterOS en lecture seule et compte de correction.
- Validation humaine avant toute correction.
- Génération de tickets Hotspot via RouterOS.
- Livraison par Telegram, WhatsApp ou imprimante.
- Signatures HMAC et idempotence pour les webhooks n8n.
- Isolation des données par espace utilisateur.
- Chiffrement serveur des secrets enregistrés en base.

## Architecture

~~~text
Navigateur
    │
    ▼
Next.js 16 / App Router ───── PostgreSQL
    │
    ├── REST RouterOS via web/lib/routeros.ts
    ├── API interne signée pour n8n
    └── Webhooks n8n signés
              │
              ▼
             n8n
       ┌──────┼────────┐
       ▼      ▼        ▼
   Telegram WhatsApp Imprimante
~~~

Le serveur MCP peut aider au diagnostic pendant le développement, mais il n’est jamais une dépendance de l’application livrée. Les communications avec RouterOS passent par le client unique 'web/lib/routeros.ts'.

## Arborescence

| Dossier | Rôle |
| --- | --- |
| 'web/' | Application Next.js 16 et API serveur |
| 'web/app/' | Pages App Router et routes API |
| 'web/lib/' | Accès base, session, RouterOS, n8n et intégrations |
| 'db/' | Schéma initial et migrations PostgreSQL |
| 'n8n/workflows/' | Workflows n8n versionnés sans secrets |
| 'scripts/n8n/' | Vérification et tests des workflows |
| 'portal/' | Éléments liés au portail ou à l’environnement historique |

## Prérequis

- Node.js LTS et npm ;
- PostgreSQL 14 ou supérieur ;
- Python 3 pour les scripts n8n ;
- un routeur MikroTik RouterOS v7 avec API REST activée ;
- une instance n8n accessible depuis l’application ;
- un bot Telegram si Telegram est activé ;
- les identifiants WhatsApp et imprimante si ces canaux sont utilisés.

## Installation locale

~~~bash
cd web
npm install
cp .env.example .env.local
~~~

Renseigne ensuite 'web/.env.local'. Ce fichier reste local et ne doit jamais être envoyé sur GitHub.

Crée la base PostgreSQL indiquée par 'DATABASE_URL', puis applique les migrations :

~~~bash
npm run db:migrer
npm run dev
~~~

L’application est disponible sur http://localhost:3000.

## Variables d’environnement

Le modèle complet se trouve dans 'web/.env.example'.

Variables essentielles :

| Variable | Utilisation |
| --- | --- |
| 'DATABASE_URL' | Connexion PostgreSQL côté serveur |
| 'SESSION_SECRET' | Signature des sessions utilisateur |
| 'CHIFFREMENT_CLE' | Chiffrement des secrets en base |
| 'ROUTEROS_USER' / 'ROUTEROS_PASS' | Compte RouterOS en lecture seule |
| 'ROUTEROS_FIX_USER' / 'ROUTEROS_FIX_PASS' | Compte réservé aux corrections |
| 'N8N_BASE_URL' | URL de l’instance n8n |
| 'N8N_WEBHOOK_SECRET' | Secret partagé pour les appels vers l’application |
| 'N8N_CALLBACK_SECRET' | Signature des retours n8n |
| 'APP_URL' | URL publique de l’application |
| 'TELEGRAM_BOT_TOKEN' | Jeton Telegram côté serveur uniquement |

Génère les secrets avec :

~~~bash
openssl rand -hex 32
~~~

Ne mets jamais de secret dans 'NEXT_PUBLIC_*', le code client, un workflow n8n exporté ou les journaux.

## Première configuration

1. Ouvre '/connexion' et crée un compte ou connecte-toi.
2. Configure une connexion Mikhmon dans '/connexions-mikhmon'.
3. Dans '/routeurs', sélectionne cette connexion et renseigne RouterOS.
4. Utilise un compte de lecture distinct pour les diagnostics.
5. Configure Telegram dans '/configuration/telegram' si nécessaire.
6. Configure les profils Hotspot et les canaux de livraison.
7. Vérifie le workflow n8n avant d’activer une génération automatique.

## Fonctionnement des tickets

1. n8n reçoit une demande depuis Telegram, l’interface ou une tâche planifiée.
2. n8n demande à SafeLink le catalogue autorisé.
3. SafeLink vérifie l’espace, le routeur, le profil et la quantité.
4. Une approbation humaine est requise lorsque le workflow le prévoit.
5. n8n génère les utilisateurs Hotspot sur RouterOS.
6. n8n livre le résultat par Telegram, WhatsApp ou imprimante.
7. Le compte rendu est signé et renvoyé à SafeLink.

Les mots de passe des tickets vivent sur le routeur et ne sont pas stockés en base ni écrits dans les journaux.

## Telegram et n8n

Le bot Telegram doit pointer vers le webhook de production n8n, jamais vers un webhook de test. Le workflow doit être actif dans n8n.

~~~bash
python3 scripts/n8n/verifier-liaison-telegram.py
python3 scripts/n8n/verifier-workflows.py
npm run test:n8n
~~~

Pour un test temporaire de l’application locale :

~~~bash
ngrok http 3000
~~~

Utilise alors l’URL HTTPS ngrok comme 'APP_URL'. Elle change lorsque le tunnel est arrêté, sauf configuration réservée.

## Vérifications

Dans 'web/' :

~~~bash
npm run lint
npm run build
~~~

Depuis la racine :

~~~bash
npm run check:integrations
npm run check:workflows
npm test
~~~

Chaque route API doit répondre avec l’une de ces formes :

~~~json
{ "data": {} }
~~~

ou :

~~~json
{ "error": "Message en français." }
~~~

## Sécurité

- Ne jamais écrire sur un routeur sans sauvegarde et plan approuvé.
- Ne jamais automatiser les règles 'input' du pare-feu, '/ip/service', l’adressage IP ou les routes.
- Désactiver un objet RouterOS au lieu de le supprimer.
- Ne jamais confondre le compte d’audit et le compte de correction.
- Vérifier la signature de chaque webhook entrant.
- Rendre chaque webhook idempotent.
- Ne jamais journaliser un mot de passe de ticket ou un secret.
- Ne jamais committer '.env.local', les tokens, mots de passe ou clés.
- Tester les canaux de livraison sans envoyer de données réelles lorsque possible.

## Déploiement Docker

Le déploiement de production doit utiliser un projet Docker séparé, avec :

- un conteneur Next.js dédié ;
- un conteneur PostgreSQL et un volume persistant dédiés ;
- un réseau Docker dédié ou un raccordement Traefik vérifié ;
- aucun port 80 ou 443 pris directement par l’application ;
- un routeur Traefik dédié pour 'app.safelinkhub.io' ;
- les secrets injectés par l’environnement du serveur, jamais dans l’image.

Ne jamais exécuter un 'docker compose down' global, 'docker system prune' ou une suppression de volume sans validation explicite.

## Dépannage

### Erreur d’authentification

Vérifie 'SESSION_SECRET', le cookie de session et l’accès à '/connexion'.

### Liste des connexions vide

Vérifie que PostgreSQL utilise la même 'DATABASE_URL' que le script de migration :

~~~bash
cd web
npm run db:migrer
~~~

### Telegram ne répond pas

Vérifie 'getMe', le webhook de production, l’activation du workflow n8n, 'APP_URL' et 'N8N_WEBHOOK_SECRET'.

### n8n répond mais ne livre rien

Vérifie les exécutions du workflow, la correspondance du Chat ID et la réponse de '/api/telegram/catalogue'. Un '404' signifie généralement que 'APP_URL' ne pointe pas vers Auto-Pilot.

## Contribution

Le dépôt est en développement. Toute modification touchant RouterOS, n8n, l’authentification ou les secrets doit être accompagnée d’une vérification locale et d’une documentation en français.
