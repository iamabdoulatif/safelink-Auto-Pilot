# Tutoriel PrintNode — impression automatique des tickets

But : quand des tickets Hotspot sont générés, le PDF part tout seul vers
l'imprimante du site, sans téléchargement manuel.

Le principe, en une phrase : PrintNode est un service en ligne qui parle
à un petit logiciel (le « client PrintNode ») installé sur le PC relié à
l'imprimante ; notre application envoie le PDF à PrintNode, PrintNode le
transmet au PC, le PC imprime.

## Les 3 paramètres du webhook (créés automatiquement)

Dans PrintNode, un webhook se crée avec trois paramètres. Notre
application les crée pour toi à l'enregistrement (page Configuration
PrintNode → « Enregistrer et tester »), tu n'as rien à coller :

| Paramètre  | Valeur créée par l'application |
|------------|--------------------------------|
| `url`      | `APP_URL` + `/api/printnode/webhook` (adresse publique https de l'application) |
| `secret`   | Chaîne aléatoire propre à ton espace, chiffrée en base, jamais affichée. PrintNode la renvoie dans l'en-tête `x-printnode-webhook-secret` de chaque notification. |
| `messages` | `["print job state"]` : seuls les états d'impression (envoyé, imprimé, erreur). |

Limites PrintNode à connaître : 5 webhooks maximum par compte (l'app met
à jour le sien au lieu d'en recréer), et une notification n'est
considérée comme reçue que si l'application répond HTTP 200 avec
l'en-tête `X-PrintNode-Webhook-Status: OK` — c'est ce que fait notre
endpoint. Tu peux voir (sans les recréer) les webhooks du compte ici :
<https://api.printnode.com/app/webhooks>.

## Étape 1 — Compte et clé API

1. Crée un compte sur <https://www.printnode.com>.
2. Ouvre <https://app.printnode.com/apikeys> et crée une clé API.
   Garde-la pour l'étape 4. Ne la mets jamais dans un fichier public :
   dans l'application, elle est chiffrée et jamais réaffichée.

## Étape 2 — Installer le client sur le PC de l'imprimante

Le client se télécharge ici : <https://www.printnode.com/en/download>.
Choisis la version de ton système (Windows ou macOS) sur le PC qui est
branché à l'imprimante (USB ou réseau local).

### Windows

1. Lance le fichier téléchargé et suis l'installeur.
2. Le client démarre automatiquement avec Windows (icône près de
   l'horloge). Ouvre-le et connecte-toi avec ton compte PrintNode.
3. Branche l'imprimante, allume-la, installe son pilote Windows si
   Windows ne la reconnaît pas tout seul.

### macOS

1. Ouvre le fichier téléchargé et glisse PrintNode dans Applications.
2. Lance PrintNode depuis Applications. Si macOS bloque l'ouverture
   (application téléchargée), fais un clic droit sur l'app → Ouvrir,
   puis confirme.
3. Connecte-toi avec ton compte PrintNode, branche et allume
   l'imprimante. Si elle n'apparaît pas, ajoute-la dans
   Réglages Système → Imprimantes et scanners.

Dans les deux cas : l'imprimante doit apparaître dans le client
PrintNode, puis dans le tableau de bord PrintNode (menu Printers).
Note son **identifiant numérique** (printerId), il sert à l'étape 4.

## Étape 3 — Adresse publique (production uniquement)

PrintNode est en ligne : il doit pouvoir appeler l'application pour
livrer les états d'impression. En production, `APP_URL` (fichier
`web/.env.local`) doit donc être l'adresse publique https de
l'application, par exemple `https://app.ton-domaine.tld`.
En local (`http://localhost:3000`), le webhook est créé mais PrintNode
ne peut pas joindre ton poste : les notifications échouent, c'est
normal, elles réussiront une fois l'application publiée.

## Étape 4 — Configurer dans SafeLink

1. Menu **Configuration PrintNode**.
2. Colle la clé API (étape 1).
3. Saisis l'identifiant de l'imprimante (étape 2).
4. Choisis le format papier (A4, A5 ou Letter) et laisse
   l'activation cochée.
5. Clique **Enregistrer et tester** : l'application vérifie que
   l'imprimante existe sur ton compte, puis crée le webhook tout seul.
   Le bloc « Configuration actuelle » doit afficher l'imprimante,
   le statut « en-ligne » et « Webhook : configuré n° … ».

## Étape 5 — Imprimer

Génère des tickets comme d'habitude (menu Générer des tickets, canal
PrintNode) : le workflow envoie le PDF à PrintNode, qui le transmet au
PC, qui imprime. Conditions pour que ça parte :

- PC allumé, client PrintNode ouvert et connecté ;
- imprimante allumée, papier chargé, pas d'erreur (bourrage, hors ligne) ;
- configuration SafeLink « en-ligne » et active.

L'application refuse l'impression automatique tant que la configuration
n'est pas testée « en-ligne » : c'est une protection, pas un bug.

## Dépannage

| Symptôme | Vérification |
|---|---|
| Rien ne s'imprime | Client PrintNode ouvert sur le PC ? Imprimante visible dedans ? Essaie une page de test depuis le client. |
| « Clé API PrintNode refusée » | Recrée une clé sur <https://app.printnode.com/apikeys> et ré-enregistre. |
| « Imprimante introuvable » | Mauvais identifiant : reprends celui du menu Printers de PrintNode, PC connecté. |
| Webhook « non configuré » | `APP_URL` absente/invalide, ou échec réseau : corrige `web/.env.local` puis ré-enregistre. |
| États d'impression jamais reçus | Normal en localhost. En production : vérifie que `APP_URL` est bien l'URL publique https, et les compteurs (received/failed) sur <https://api.printnode.com/app/webhooks>. |
| Plus de webhook créé | Compte limité à 5 webhooks : supprime les anciens inutiles dans PrintNode, puis ré-enregistre (l'app réutilise le sien). |

## Sécurité

- Clé API et secret du webhook : chiffrés en base (AES-256-GCM),
  jamais affichés, jamais journalisés.
- Chaque notification entrante est vérifiée (secret comparé en temps
  constant) et dédoublonnée : un événement déjà reçu n'est pas retraité.
- Le mot de passe des tickets Hotspot n'existe que dans le routeur :
  PrintNode ne reçoit que le PDF à imprimer.
