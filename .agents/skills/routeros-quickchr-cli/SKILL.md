---
name: routeros-quickchr-cli
description: "Répondre à une question RouterOS en interrogeant RouterOS. quickchr démarre un vrai routeur MikroTik CHR jetable sur la machine locale sous QEMU — sans matériel, sans cloud, supprimé quand on le retire — et centrs le pilote. Couvre le parcours shell de bout en bout : le cycle de vie add/start/stop/shutdown/remove, récupérer le shell (--no-wait ; --bg ne le fait pas), extraire d'une machine les points d'accès REST et les identifiants, les liens L2 entre deux VM, le provisionnement (device-mode) qui s'applique au premier démarrage et la voie set ensuite, et RouterOS 6 comme cible en démarrage seul. Épinglé à quickchr 0.5.2. À utiliser pour : vérifier une affirmation ou une configuration contre un vrai RouterOS au lieu de deviner ; besoin d'un routeur jetable pour itérer sur REST/CLI/API ; fournir à un script shell ou à un job CI un routeur avec qui dialoguer. Pour les harnais TypeScript qui importent la classe QuickCHR, utiliser routeros-quickchr à la place."
---

# CHR depuis le shell : quickchr CLI + centrs

quickchr ([`@tikoci/quickchr`](https://github.com/tikoci/quickchr), CLI + bibliothèque
Bun/TS) télécharge une image MikroTik CHR, la démarre sous QEMU et vous remet
un routeur. Cette skill est la voie **shell d'abord** : vous avez un terminal,
vous voulez un routeur à interroger, et la réponse sera citée sous forme de
commandes shell + RouterOS (par ex. dans une réponse `forum.mikrotik.com`).
Si vous écrivez un harnais `bun:test` qui importe `QuickCHR`, utilisez plutôt
la skill **routeros-quickchr** — un schéma par tâche, jamais les deux.[^split]

Le comportement décrit ci-dessous est épinglé à **0.5.2**. Installez avec
`bun install -g @tikoci/quickchr@0.5.2`, ou invoquez
`bunx @tikoci/quickchr@0.5.2 <command>`. Vérifiez votre version avec
`quickchr --version`. Quand 0.4.8 et les versions antérieures diffèrent d'une
façon qui peut vous nuire, le texte le signale en ligne ; le reste de
l'historique des versions figure dans les notes de bas de page.[^pin]

Une limite à garder en vue : un CHR démarré ainsi fonctionne avec la licence
**free** (`quickchr get <name>` affiche `Level: free`), que MikroTik plafonne
à **1 Mbps d'envoi par interface** — toutes les autres fonctionnalités
RouterOS sont illimitées. L'ancrage de la configuration, de l'API et du CLI
n'est pas affecté ; un chiffre de débit ou de file d'attente mesuré ici
reflète la licence, pas la fonctionnalité.[^license]

## Prérequis hôte et stockage

Utilisez Bun **1.4.4**, le runtime testé livré avec 0.5.2. Exécutez
`quickchr doctor` pour les dépendances manquantes et les conseils
d'installation. L'ancien drapeau `start --install-deps` provoque désormais
une erreur ; il n'a jamais installé de dépendances. La CLI utilise par défaut
**qcow2**, ce qui exige `qemu-img` ; la bibliothèque utilise par défaut
**raw** sauf si `bootSize` implique qcow2. Les disques supplémentaires exigent
aussi `qemu-img`.[^release052]

Le contrôle d'admission du stockage vérifie les octets que l'opération va
écrire plus une **réserve de 2 Gio** sur chaque système de fichiers utilisé,
en tenant compte des opérations concurrentes. L'ancien plancher de 10 Gio a
disparu. `QUICKCHR_STORAGE_RESERVE` (ou `storage-reserve`) ajuste la réserve ;
l'éviction du cache précède un refus `INSUFFICIENT_DISK_SPACE`. Les limites
du cache incluent désormais les paquets et les téléchargements partiels, de
sorte que le premier nettoyage après mise à niveau peut évincer davantage
qu'avant.[^release052]

## Cycle de vie : `add` n'est pas `start`

```sh
quickchr add --name lab-a --version 7.24.4 --arch x86 --add-network user
quickchr start lab-a
quickchr exec lab-a "/system/resource/print"
quickchr stop lab-a
quickchr remove lab-a
```

- `add` ne fait qu'écrire la configuration (0 s avec un cache chaud) et
  affiche `quickchr start <name>` comme conseil. **Il ne démarre jamais** —
  l'hypothèse erronée la plus fréquente au sujet de cette CLI.[^ground-add]
- `start` bloque jusqu'à ce que l'invité soit prêt pour REST, puis affiche
  les points d'accès REST/SSH/WinBox (≈22–25 s au premier démarrage, ≈11–20 s
  au redémarrage, HVF avec cache chaud). `--no-wait` rend la main dès que
  QEMU tourne (section suivante). Sous émulation logicielle TCG, attendez-vous
  à des minutes, pas des secondes — un labo de terrain en bac à sable a
  observé des démarrages d'environ 4 min et un vrai `BOOT_TIMEOUT` à 480 s.
  Dimensionnez les délais du harnais en partant du cas le plus lent.[^ground-timings]
- **`start` sur un nom qui n'existe pas le crée** — le flux en une seule
  commande. Un nom mal saisi démarre donc une machine d'usine sur des ports
  neufs au lieu de produire une erreur, ce qui après un démarrage raté peut
  donner l'impression que votre machine est revenue altérée. Vérifiez avec
  `quickchr list` avant de réessayer un nom. Depuis 0.5.1, le statut indique
  "created and started" ("created — not waiting for RouterOS" avec
  `--no-wait`) ; reprendre une machine existante affiche
  "started".[^release052]
- `exec <name> <command…>` exécute une commande RouterOS via REST.
  `--via` vaut ici `auto|rest|qga`, et **`qga` est plus étroit qu'il
  n'y paraît** : RouterOS ne démarre son agent invité que pour un CHR
  **x86** sous **Linux KVM**. Sous macOS HVF ou TCG, le port est présenté
  mais l'invité ne l'ouvre jamais, et le CHR ARM64 n'a pas du tout de QGA —
  les deux expirent par délai. Restez sur REST sauf si vous êtes sur
  Linux/KVM avec un invité x86. (Le type `ExecTransport` de la bibliothèque
  liste aussi `ssh` et `console` ; ceux-ci ne font pas partie de la surface
  CLI.) `remove` supprime la machine. `list` affiche l'état et les
  PID.[^ground-exec]
- **`stop` est une coupure de courant** : SIGTERM à QEMU, puis SIGKILL après
  5 s. Il ne demande pas à RouterOS de s'arrêter, donc l'état invité non
  enregistré peut être perdu. C'est acceptable pour un labo jetable. Pour une
  sortie propre sous RouterOS 7, `quickchr shutdown <name> [--timeout <s>]`
  envoie `/system/shutdown` via REST, attend jusqu'à 10 s par défaut
  (`QUICKCHR_SHUTDOWN_TIMEOUT`) que QEMU se termine, puis se rabat sur une
  coupure de courant signalée comme "forced". Sous RouterOS 6, la requête
  REST échoue aussitôt, donc `shutdown` laisse passer tout le délai puis
  coupe l'alimentation ("forced", code de sortie 0) — utilisez plutôt `stop`
  dans ce cas. Disques et identifiants survivent dans les deux cas.[^shutdown]
- **`start --all`** démarre chaque machine arrêtée en arrière-plan. Il
  n'accepte que `--no-wait`, `--bg`/`--background`, `--accel`,
  `--timeout-extra` et `--[no-]secure-login` ; toute autre option échoue avec
  `INVALID_ARGUMENT` au lieu d'être silencieusement ignorée (0.5.0+).
  Démarrez une machine par son nom pour passer autre chose.[^start-all]
- **Choix de la version** : `--version 7.24.4` épingle ; `--channel
  stable|long-term|testing|development` résout la plus récente d'un canal. Un
  simple `quickchr --version` affiche ce que chaque canal résout
  actuellement.[^ground-channel]
- **Les ports sont auto-alloués** à partir de 9100 par blocs de dix par
  machine (9140, 9150, 9160 …), de sorte que les machines créées l'une après
  l'autre n'entrent pas en collision et qu'aucune comptabilité des ports
  n'est nécessaire. `--port-base` surcharge ce comportement ;
  `--forward name:host:guest/proto` ajoute des redirections supplémentaires,
  plages incluses.[^ground-ports]
- **Créer plusieurs machines à la fois**
  (`quickchr start a & quickchr start b &`) est sûr : les créations
  concurrentes obtiennent des blocs de ports distincts, un `--port-base`
  chevauchant est refusé avec `PORT_CONFLICT`, et `stop`/`remove` attendent
  un `start` en cours sur la même machine. Un `start` au premier plan
  verrouille la machine jusqu'à la fin de sa VM, donc ils échouent avec
  `MACHINE_LOCKED` au lieu d'attendre. (Avant 0.5.0, les deux pouvaient
  choisir le même bloc et l'un échouait avec `SPAWN_FAILED` — démarrez-les
  une par une dans ce cas.)[^ground-concurrent]
- **Pré-chauffer sans démarrer** : `quickchr cache add --version 7.24.4
  --arch x86` résout et télécharge une image, sans QEMU ni machine requise.
  `cache key` affiche `dir=/version=/arch=` pour la CI.[^ground-cache]
- **Ne modifiez jamais `machine.json` à la main** pour changer les réseaux
  ou les options — cela casse le démarrage. Tout est accessible via les
  drapeaux de `add`.[^field]
- **Gardez `QUICKCHR_DATA_DIR` court sous macOS.** Le socket du moniteur
  QEMU vit en dessous, et un chemin de socket de 104 octets ou plus fait
  échouer `start` avec `SPAWN_FAILED` ("UNIX socket path … is too
  long").[^socket-path]

## Récupérer le shell : `--no-wait`, pas `--bg`

**`--bg` n'a jamais rendu la main tôt.** L'arrière-plan est déjà le défaut. Le
drapeau ne faisait que ne pas sélectionner le mode avant-plan que vous
n'aviez pas demandé, et `start` attendait dans tous les cas que REST soit
prêt. Il est désormais déprécié : il ne fait rien et affiche un
avertissement sur stderr. (En 0.4.8, il était silencieusement inoffensif.)
Omettez-le dans les scripts. `--fg`/`--foreground` est l'interrupteur qui
fait quelque chose.[^bg]

**`--no-wait`.** `start` rend la main dès que QEMU tourne (environ 2 s), avec
l'état et les ports déjà enregistrés, et la disponibilité vous appartient.
centrs 0.1.8+ l'attend avec une borne :

```sh
quickchr start lab-a --no-wait
centrs retrieve --quickchr lab-a /system/resource --wait 5m
```

Il est refusé (`INVALID_ARGUMENT`, rien de démarré) quand il est combiné avec
`--fg` ou avec un drapeau de provisionnement. Cela inclut le provisionnement
que `add` a enregistré et que le premier démarrage n'a pas encore appliqué.
Le provisionnement s'exécute contre l'invité démarré, donc ce premier `start`
doit attendre. Les démarrages suivants peuvent utiliser
`--no-wait`.[^nowait]

En 0.4.8, il n'y a pas de `--no-wait` : mettez vous-même `start` en
arrière-plan (`nohup quickchr start lab-a >lab-a.start.log 2>&1 &`) et
interrogez la disponibilité avec une borne, comme au paragraphe suivant.

**Bornez l'attente.** `start` peut échouer franchement — `MISSING_QEMU`,
`SPAWN_FAILED`, `BOOT_TIMEOUT` — et une boucle `until` sans borne interroge
alors indéfiniment, ce qui en CI donne un job bloqué sans diagnostic.
Dimensionnez la borne en partant du cas le plus lent (TCG en minutes, pas HVF
en secondes) et, en cas de délai dépassé, affichez `quickchr list` plus le
journal de démarrage au lieu de simplement quitter.[^ground-poll]

**Un `start` tué n'arrête pas la VM.** QEMU est lancé en mode `detached` (sa
propre session), donc même un harnais qui envoie SIGKILL à tout le groupe de
processus laisse l'invité démarrer — il devient prêt pour REST sans plus rien
pour le signaler. Vérifié contre les deux versions publiées : un SIGKILL de
groupe 8 s après le début d'un premier démarrage a fait tomber la VM en
**0.4.7**, et l'a laissée tourner et prête pour REST en **0.4.8** et
ultérieur. Ne déduisez donc jamais « start a échoué » d'une CLI tuée —
vérifiez avec `quickchr list` et interrogez REST, puis nettoyez avec
`stop`/`remove`. Si vous êtes épinglé en dessous de 0.4.8, ce kill emporte
*bien* la VM avec lui — mettez à niveau plutôt que de contourner.[^ground-bg]

**Un `BOOT_TIMEOUT` nettoie après lui.** quickchr arrête d'abord QEMU,
puis :[^boot-timeout]

- créée par ce `start` — supprimée ;
- créée par `add`, jamais démarrée — réinitialisée au disque d'usine,
  options de `add` conservées ;
- déjà démarrée (un redémarrage) — préservée : réessayez avec `start`.

En 0.4.8 et antérieur, le cas du redémarrage était lui aussi **supprimé**,
sauf si `QUICKCHR_PRESERVE_ON_FAILURE=1` était défini au préalable — un
démarrage lent supprimait une machine que vous aviez configurée à la main. En
0.5.0, le drapeau conserve encore les deux premiers cas pour inspection.

## Ordre des NIC et lien à deux VM

- Mettez `user` **en premier** : `--add-network user --add-network
  'socket::lab-link'`. RouterOS n'attribue un DHCP automatique qu'à ether1
  (observé : `10.0.2.15/24` dynamique), et les redirections de ports de
  l'hôte le présupposent.[^ground-nic]
- Pour un lien L2 entre deux VM, préférez un **socket nommé**
  `socket::<name>`. Il se résout via une entrée de registre, utilise par
  défaut `dgram` (une paire de datagrammes unix) hors Windows, et **chaque
  machine peut démarrer en premier** — il n'y a pas de rôles
  écouteur/connecteur à inverser. `start` affiche le transport vers lequel
  chaque lien s'est résolu. Vérifié : deux machines sur un lien `socket::`,
  démarrées dans un ordre quelconque, `/24` statiques sur ether2, ping 3/3 sur
  un hôte macOS.[^ground-l2]
- La paire brute `socket:listen:<port>` / `socket:connect:<port>` est la forme
  sensible à l'ordre — une paire TCP où **l'écouteur doit démarrer en
  premier**. N'y recourez que lorsque vous avez besoin de ces rôles
  explicites ; `socket::<name>` existe pour éviter le problème
  d'ordre.[^ground-forms]
- Une troisième machine sur un lien à deux machines est refusée **au `start`**
  (pas au `add`), en nommant les deux détenteurs et en pointant vers `--mode mcast`. Ce refus *est* le contrôle de configuration qui
  fonctionne.[^ground-third]

## Quel transport : `dgram` par défaut, `mcast` sur option

`quickchr networks sockets create <name>` accepte `--mode
dgram|listen-connect|mcast` et **affiche le transport qu'il a créé** — croyez
la sortie, pas le nom. Le défaut est `dgram` (paire de datagrammes unix,
confinée au système de fichiers, deux machines) sous macOS/Linux et
`listen-connect` (paire TCP) sous Windows, qui n'a pas de socket datagramme
AF_UNIX. `--mode mcast` est du multicast UDP `230.0.0.1` — le seul transport
N-voies, et le seul qui échoue silencieusement.[^ground-sock]

quickchr affiche les trois dangers ci-dessous en avertissement quand vous
créez un lien `mcast`. **Deux d'entre eux échouent silencieusement** — même
signature à chaque fois : interfaces montées, adresses attribuées, 100 % de
perte, rien dans les journaux :[^mcast]

- **Pas de distribution sous macOS** — le socket multicast de QEMU omet
  `SO_REUSEPORT`, que BSD/macOS exigent pour que deux sockets d'un même
  groupe reçoivent tous deux (tikoci/quickchr#167).
- **Refusé là où les envois UDP non connectés sont bloqués** — les bacs à
  sable filtrés par seccomp et certaines CI Linux renvoient `EPERM` sur
  `sendto()` alors que l'adhésion au groupe réussit (tikoci/quickchr#169).

Le troisième est l'échec inverse — le trafic circule là où il ne devrait
pas :

- **Non confiné à votre machine** — quickchr ne passe pas de `localaddr=`,
  donc le groupe emprunte l'interface multicast par défaut de l'hôte. Un
  autre hôte de votre LAN utilisant le même groupe **rejoint votre segment**,
  et le lien continue de fonctionner, donc rien ne semble anormal. C'est un
  échec d'isolation, pas un échec de perte. Donnez à un lien N-voies un
  groupe à lui seul, ou restez sur `dgram` pour deux machines.

## Piloter le routeur : `centrs --quickchr`

Une fois la machine démarrée, lectures et écritures passent par centrs
([`@tikoci/centrs`](https://github.com/tikoci/centrs)) en ciblant la machine
par son nom — il résout le point d'accès via `quickchr inspect`, donc aucune
plomberie d'identifiants :[^ground-drive]

```sh
centrs retrieve --quickchr lab-a /system/resource
centrs execute --quickchr lab-a --yes '/ip/address/add interface=ether2 address=198.51.100.1/24'
```

Les lectures n'exigent aucun drapeau ; **les écritures sont refusées sans
`--yes`** (`[usage/confirmation-required]`). Une instruction RouterOS par
appel.

Préférez-le à `quickchr exec` : quickchr lui-même le dit, dans `exec --help`
et dans un conseil sur stderr lors d'un `quickchr exec` nu (désactivable avec
`QUICKCHR_NO_TIPS=1` ; les conseils ne touchent jamais stdout, donc `--json`
reste analysable). `quickchr exec` est **un tuyau `/rest/execute` brut sans
validation** — ce que vous saisissez est ce qu'on demande à RouterOS
d'exécuter, et sa sortie est du texte raclé d'écran là où centrs renvoie du
JSON typé.[^ground-tips]

Besoin du point d'accès brut à la place — curl, ou un autre outil ?
`quickchr inspect <name> --json` contient l'URL résolue **et des identifiants
prêts à l'emploi**. Ici CHR utilise `admin` avec un mot de passe *vide*, et
inspect vous remet l'en-tête Basic déjà encodé :

```json
"rest-api": { "url": "http://127.0.0.1:9150/rest", "port": 9150,
              "auth": { "username": "admin", "password": "", "basic": "admin:" } }
```

(`auth` contient aussi un `header` pré-encodé si vous préférez ne pas
construire vous-même la valeur Basic.) Directement vers curl :

```sh
url=$(quickchr inspect lab-a --json | jq -r '.services["rest-api"].url')
curl -s -u admin: "$url/system/resource" | jq .
```

C'est la même porte qu'utilise centrs — `--quickchr` se résout via
`quickchr inspect`, jamais en lisant `machine.json` — c'est pourquoi il
n'exige de vous aucune configuration d'identifiants.[^ground-inspect]

## Device-mode : la fenêtre se ferme au premier démarrage

Deux pièges, que les agents rencontrent dans cet ordre.

**La voie côté invité ne fonctionne pas.** `/system/device-mode/update
container=yes` via REST ou API ne se termine pas — RouterOS attend un cycle
d'alimentation qu'il ne peut pas effectuer sur lui-même — et la
fonctionnalité reste à `false`. Observé en direct : l'appel n'est pas revenu
dans le délai client de 10 s et `container` était inchangé ensuite. (On n'a
pas établi s'il reviendrait *un jour* ; un labo de terrain a rapporté ~5 min
d'attente.) N'y recourez pas, et ne lisez pas le délai dépassé comme un
problème de transport.[^dm-trap]

**Les drapeaux de provisionnement s'appliquent au premier démarrage d'une
machine.** quickchr applique le device-mode par provisionnement : démarrer
l'invité, régler le mode, recycler l'alimentation de QEMU via le moniteur,
relire pour confirmer (≈45 s contre ≈22 s sans). Cela s'exécute au premier
démarrage, donc passez-le à `add`, ou au premier `start` d'une machine que
`add` a créée sans option. Après ce démarrage :[^dm-window]

| `start --device-mode-enable container` sur… | 0.5.2 |
|---|---|
| une machine jamais démarrée | s'applique — "Device-mode verified: mode=rose container=yes" |
| une machine qui a déjà démarré | refusé, `PROVISIONING_WINDOW_CLOSED`, avec la commande `quickchr set …` à exécuter |
| une machine qui l'a déjà | "already applied — nothing to do", et elle démarre |

(En 0.4.8, une machine déjà démarrée ignorait silencieusement la demande :
`container=false` restait faux ; un conteneur déjà activé restait activé.)

**Le changer plus tard.** `quickchr set <name> --device-mode-enable
container` fonctionne sur une machine en cours d'exécution. Il affiche chaque
réglage qui va changer, recycle l'alimentation une fois, vérifie et
enregistre le changement. Relisez avec `quickchr get <name> device-mode`.
Observé : 21 s, puis `container` listé sous Enabled.[^dm-set]

Avant 0.5.0, la CLI n'avait pas de voie post-démarrage : `remove`, puis `add --device-mode-enable …`, puis `start` était le seul chemin CLI. Le
`instance.setDeviceMode()` de la bibliothèque recycle l'alimentation pour
vous sur les deux versions (voir **routeros-quickchr**).

Les autres drapeaux de provisionnement sont eux aussi refusés après le premier
démarrage (`--add-package`, `--add-user`, `--disable-admin`,
`--secure-login`, `--license-*`, `--install-all-packages`). Le refus nomme la
voie qui fonctionne encore. Pour tout ce qui n'en a pas, `quickchr clean <name>` réinitialise le disque et rouvre la fenêtre, au coût d'un premier
démarrage. Répétez ensuite la commande d'origine, car une demande refusée
n'est pas enregistrée.[^window]

Le refus vous indique de quel côté de la ligne se trouve une machine — aucun
travail de détective requis avant de vous fier à un drapeau :

```sh
quickchr get <name>    # live Device Mode / License / Admin Users
```

Activer `container` déplace aussi le mode lui-même (`advanced` → `rose`). Le
provisionnement exige RouterOS **7.20.8+** *et* une NIC en mode utilisateur —
avec uniquement des NIC socket, il échoue avec `NETWORK_UNAVAILABLE` ; les
7.x plus anciens sont en démarrage seul.[^device-mode]

## RouterOS 6 : démarrage seul

quickchr démarre le CHR RouterOS 6 pour les travaux de migration v6→v7
(0.5.0+). C'est au mieux, CLI uniquement, et x86 uniquement. quickchr
n'exécute ni REST ni provisionnement contre lui :[^v6]

```sh
quickchr add --name lab6 --version 6.49.23 --arch x86
quickchr start lab6    # ready on a native-API login, ~27s on HVF
centrs retrieve --quickchr lab6 /system/resource --via native-api --no-validate
```

- `--arch arm64` est refusé avec `INVALID_ARCH`, car MikroTik ne publie pas
  de CHR arm64 pour 6.x.
- Chaque drapeau de provisionnement, ainsi que les voies `set`, échouent avec
  `PROVISIONING_VERSION_UNSUPPORTED`.
- `quickchr exec`, les groupes live de `get` et les appels REST échouent
  aussitôt avec `REST_UNAVAILABLE` et n'expirent pas par délai. Utilisez l'API
  native, comme ci-dessus. `--no-validate` est requis car centrs valide
  contre l'arbre de commandes 7.x.
- `list`, `inspect`, `stop`, `remove` et `start --no-wait` fonctionnent comme
  en 7.x. `shutdown` ne peut pas demander à un invité 6.x de s'arrêter : il
  laisse passer son délai puis signale une coupure de courant forcée, donc
  `stop` est l'équivalent plus rapide.

En 0.4.8 et antérieur, un `start` 6.x attend une API REST que 6.x n'a pas, et
expire par délai. Utilisez 7.x dans ce cas, ou mettez à niveau.

## Fondement de cette skill

- [`references/cli-grounding.md`](./references/cli-grounding.md) — les
  exécutions réelles (commandes, sorties, durées, environnement) et une liste
  explicite de ce qui n'y a *pas* été revérifié.
- quickchr [`MANUAL.md`](https://github.com/tikoci/quickchr/blob/main/MANUAL.md),
  [`DESIGN.md`](https://github.com/tikoci/quickchr/blob/main/DESIGN.md),
  [`docs/networking.md`](https://github.com/tikoci/quickchr/blob/main/docs/networking.md),
  [`CHANGELOG.md`](https://github.com/tikoci/quickchr/blob/main/CHANGELOG.md) —
  référence autoritaire du comportement ; la skill privilégie les concepts CLI
  stables aux drapeaux spécifiques à une version.
- Labo de terrain à l'origine de cette skill : notes externes du labo 3-CHR
  (muse-app, 2026-09-19/20) — `add` ne démarre pas, démarrages détachés +
  interrogation REST, cycle d'alimentation à froid pour le device-mode,
  écart de pré-chauffage du cache.

[^split]: Justification de la scission : tikoci/routeros-skills#21. Les
  consommateurs de la bibliothèque restent sur **routeros-quickchr** ; les
  agents shell d'abord viennent ici.
[^release052]: [CHANGELOG 0.5.2](https://github.com/tikoci/quickchr/blob/v0.5.2/CHANGELOG.md)
  `[0.5.1]` et `[0.5.2]` de quickchr ;
  [revue du paquet](./references/cli-grounding.md#quickchr-052-package-review).
[^pin]: Les changements 0.5.2 ont été vérifiés contre le paquet publié
  ([revue du paquet](./references/cli-grounding.md#quickchr-052-package-review)).
  Observations épinglées : les affirmations 0.5.0 ont été réexécutées contre
  `@tikoci/quickchr@0.5.0` et `@tikoci/centrs@0.1.8` publiés, CHR 7.24.5 et
  6.49.23 x86 (`references/cli-grounding.md` §quickchr 0.5.0 re-check), et
  contrôlées contre la section `[0.5.0]` du
  [`CHANGELOG.md`](https://github.com/tikoci/quickchr/blob/main/CHANGELOG.md)
  de quickchr. Sous ce passage se trouve celui de 0.4.8 (CHR 7.24.4 x86, QEMU
  11.1.1 + HVF sur macOS Intel, 0.4.7 comme témoin) : le défaut `dgram` des
  sockets nommés, le transport affiché, le refus à trois machines et le
  détachement POSIX sont tous arrivés en 0.4.8 (quickchr #158, #159) et sont
  absents de 0.4.7.
[^ground-add]: `references/cli-grounding.md` §Lifecycle timings.
[^ground-timings]: Idem (0.4.8 : 22 s / 11 s) ; §quickchr 0.5.0 re-check
  (0.5.0 : 25 s / 20 s, CHR 7.24.5). Bande TCG et `BOOT_TIMEOUT` à 480 s
  d'après les notes du labo de terrain.
[^ground-exec]: Idem, §Lifecycle timings.
[^ground-cache]: `references/cli-grounding.md` §Cache ; CHANGELOG 0.4.8 de
  quickchr, "Added" (`cache add`, `cache key`).
[^field]: Notes du labo de terrain : `--add-network` au moment de `add`,
  jamais de `machine.json` édité à la main.
[^bg]: 0.4.8 : `src/cli/index.ts` — "Background default: true. Explicitly
  foreground only with --fg / --foreground / --no-background / --no-bg", et
  `quickchr start --help` affiche `--bg / --background   Run in background (default)`. 0.5.0 : CHANGELOG `[0.5.0]` Breaking, "`start --bg` /
  `--background` are deprecated and do nothing" (tikoci/quickchr#159). Le
  texte d'avertissement est cité dans `references/cli-grounding.md`
  §quickchr 0.5.0 re-check.
[^ground-bg]: `references/cli-grounding.md` §Group-kill, qui consigne
  l'avant/après 0.4.7 contre 0.4.8. Inchangé en 0.5.0 : MANUAL.md `start` —
  "QEMU runs detached in its own session either way".
[^nowait]: MANUAL.md `start` de quickchr (ligne `--no-wait` et exemple centrs
  0.1.8+) ; CHANGELOG `[0.5.0]` Added (#159). Les trois refus reproduits dans
  `references/cli-grounding.md` §quickchr 0.5.0 re-check.
[^shutdown]: MANUAL.md `stop` de quickchr ("Power cut: sends SIGTERM to QEMU,
  waits up to 5 seconds, then SIGKILL") et `shutdown` ; CHANGELOG `[0.5.0]`
  Added et Fixed (#143). Les issues "guest exited" et "already stopped" ont
  été observées en 7.x. Le repli forcé a été observé sur RouterOS 6.49.23 avec
  0.5.2 (`references/cli-grounding.md` §quickchr 0.5.2 package review) ; il
  n'était pas forcé en 7.x.
[^start-all]: MANUAL.md `start` de quickchr (ligne `--all`) ; CHANGELOG
  `[0.5.0]` ; le contrôle `batchFlags` dans `cmdStart()`,
  `src/cli/index.ts` à `v0.5.2`. Le refus a été reproduit dans
  `references/cli-grounding.md` §quickchr 0.5.2 package review.
[^socket-path]: Observé sous macOS pendant la mise en place de la
  revérification 0.5.0 (`references/cli-grounding.md`) ; QEMU signale "Path
  must be less than 104 bytes".
[^boot-timeout]: 0.5.0 : MANUAL.md de quickchr §"Auto-cleanup on boot
  timeout" ; CHANGELOG `[0.5.0]` Breaking (#182) et Fixed (#189). 0.4.8 :
  `cleanupAfterBootFailure()` dans `src/lib/quickchr.ts` au tag `v0.4.8`
  appelle `stop()`, puis `remove()` sauf si
  `QUICKCHR_PRESERVE_ON_FAILURE=1`. Non provoqué en direct dans aucune des
  deux versions.
[^dm-set]: MANUAL.md `set` de quickchr ; reproduit dans
  `references/cli-grounding.md` §quickchr 0.5.0 re-check.
[^window]: MANUAL.md de quickchr §5 "Provisioning pipeline" (la fenêtre, la
  table des voies, et `clean()` qui conserve l'intention) ; CHANGELOG
  `[0.5.0]` Fixed (#176). `clean` n'a pas été exécuté dans la revérification.
[^v6]: MANUAL.md de quickchr §"RouterOS 6 (boot-only)" ; CHANGELOG `[0.5.0]`
  Added (#182), qui donne aussi le comportement 0.4.8 ("ready in ~25 s under
  HVF instead of timing out against a REST API it does not have"). Le refus
  arm64, le refus de provisionnement, le démarrage en 27 s,
  `REST_UNAVAILABLE` et la lecture en API native figurent dans
  `references/cli-grounding.md` §quickchr 0.5.0 re-check.
[^ground-nic]: `references/cli-grounding.md` §First NIC.
[^ground-l2]: `references/cli-grounding.md` §Named-socket link.
[^ground-forms]: `parseSocketSpecifier()` dans `src/lib/network.ts` de
  quickchr accepte `socket::<name>`, `socket:listen:<port>`,
  `socket:connect:<port>`, `socket:mcast:<group>:<port>` ;
  `docs/networking.md` — "Named sockets avoid the listen/connect ordering
  problem".
[^ground-third]: `references/cli-grounding.md` §Third machine refused.
[^ground-sock]: `references/cli-grounding.md` §Socket create output ;
  `defaultSocketMode()` dans `src/lib/socket-registry.ts` de quickchr.
[^mcast]: DESIGN.md de quickchr, "A named socket says what it is" ;
  tikoci/quickchr#167 (distribution) et #169 (permission) ; texte
  d'avertissement cité dans `references/cli-grounding.md`.
[^ground-drive]: `references/cli-grounding.md` §Driving with centrs
  (`retrieve`, `execute --yes`, et le refus sans `--yes`).
[^ground-tips]: `quickchr exec --help` et `quickchr exec` nu en 0.4.8, cités
  dans `references/cli-grounding.md` §Driving with centrs ; CHANGELOG 0.4.8
  "Added" (conseils).
[^dm-trap]: `references/cli-grounding.md` §Device-mode — le
  `/system/device-mode/update container=yes` côté invité expirant par délai
  avec `container` inchangé, reproduit en 0.4.8 / CHR 7.24.4.
[^dm-window]: 0.4.8 : `references/cli-grounding.md` §Device-mode — la machine
  jamais démarrée a appliqué et vérifié le changement, celle déjà démarrée ne
  l'a silencieusement pas fait. La garde était `!existing.lastStartedAt` dans
  `QuickCHR.start()` (`src/lib/quickchr.ts`). 0.5.0 : tikoci/quickchr#176
  livré. La garde est le nouvel enregistrement `MachineState.provisioning`,
  et le refus ainsi que le chemin "already applied" figurent dans §quickchr
  0.5.0 re-check.
[^ground-inspect]: `references/cli-grounding.md` §Endpoints and credentials
  (`quickchr inspect --json`, `quickchr get`).
[^ground-poll]: Codes d'échec issus de l'union `ErrorCode` de quickchr
  (`src/lib/types.ts`) ; la forme bornée-avec-diagnostic est la
  recommandation de cette skill, vérifiée sous forme de script dans
  `references/cli-grounding.md` §Bounded readiness poll.
[^ground-channel]: `quickchr add --help` (`--version`, `--channel`) ;
  `quickchr --version` affiche les versions stable/long-term résolues.
[^ground-concurrent]: [tikoci/quickchr#140](https://github.com/tikoci/quickchr/issues/140)
  (deux démarrages concurrents en 0.4.7 ont tous deux choisi 9140 ; le second
  QEMU a échoué sur son bind `hostfwd`) et le correctif,
  [tikoci/quickchr#190](https://github.com/tikoci/quickchr/pull/190), publié
  en 0.5.0 (CHANGELOG `[0.5.0]` Fixed, #140 et #181) et couvert par les tests
  unitaires de concurrence de quickchr et un démarrage réel de deux CHR. Voir
  la skill **routeros-quickchr**, "Running several CHRs at once".
[^ground-ports]: `quickchr add --help` — "`--port-base <port>` Starting port
  number (default: auto-allocated from 9100)" ; machines successives
  observées en 9140/9150/9160 dans `references/cli-grounding.md`.
[^license]: MikroTik, [CHR: Licensing → CHR License
  Levels](https://manual.mikrotik.com/docs/getting-started/routeros-licensing/chr/chr-licensing#chr-license-levels):
  *"The Free license level allows CHR to run indefinitely with a 1 Mbps
  upload limit per interface. All other RouterOS features are available
  without restrictions."* Les paliers payants relèvent le plafond (P1 1
  Gbit, P10 10 Gbit, P-Unlimited), et un essai de 60 jours d'un palier payant
  est gratuit avec un compte MikroTik. C'est de la licence MikroTik, pas un
  comportement quickchr ; `quickchr get <name>` signale `License Level: free`
  sur une machine par défaut.
[^device-mode]: MANUAL.md de quickchr, "Order of operations"
  (`_provisionInstance`) ; `--device-mode-enable` dans `src/cli/flags.ts`
  (accepté à la fois par `add` et `start`, bien que le `add --help` condensé
  ne liste que `--device-mode <m>`) ; l'exigence de NIC en mode utilisateur
  est la garde `NETWORK_UNAVAILABLE` dans `QuickCHR.start()`.
