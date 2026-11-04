---
name: routeros-quickchr
description: "Valider une config, des scripts ou du code API RouterOS contre un VRAI routeur avec quickchr (@tikoci/quickchr) — une CLI + bibliothèque Bun/TS qui télécharge, démarre et gère des VM MikroTik CHR sous QEMU. Utiliser quand : valider une config ou des scripts RouterOS générés contre du vrai RouterOS avant de leur faire confiance ; démarrer un CHR jetable pour itérer en REST/CLI/API ; écrire des tests d'intégration/labo contre CHR ; besoin de réseau hôte↔invité pour un CHR (redirection de ports, capture L2/MNDP, UDP invité→hôte) ; piloter un outil RouterOS externe contre un CHR live. Pour la mécanique brute du boot QEMU/CHR (VirtIO, UEFI vs SeaBIOS, accélération) sans quickchr, utiliser routeros-qemu-chr à la place."
---

# Valider RouterOS avec quickchr

Épinglé à **0.5.2**. Lire les entrées du `CHANGELOG.md` de la release
de `[0.5.0]` à `[0.5.2]` avant de migrer depuis 0.4.x. Quand un
comportement a changé, cette compétence nomme la version.[^versions]

## À quoi ça sert

Le moyen fiable de savoir si une config, un script ou un appel API RouterOS
fonctionne vraiment, c'est de l'exécuter contre du **vrai RouterOS** — pas de
le deviner depuis la doc. quickchr
([`@tikoci/quickchr`](https://github.com/tikoci/quickchr), npm, MIT, public) le
fait en quelques lignes : il télécharge une image MikroTik **CHR** (Cloud
Hosted Router), la démarre sous QEMU, la provisionne, et vous remet un handle
REST/SSH/exec. La licence CHR gratuite (1 Mbps, sans inscription) suffit pour
valider de la config, itérer sur l'API et ancrer des tests.

**Prenez quickchr quand** vous voulez appliquer une config et la relire,
itérer en REST/scripting contre une machine live, ou lancer des tests
d'intégration contre CHR.

**Ne le prenez pas** quand il vous faut seulement de la documentation (utilisez
le MCP `rosetta` / la compétence `routeros-fundamentals`), ou quand vous
flashez du matériel physique (utilisez la compétence `routeros-netinstall`).
Pour les entrailles brutes du boot QEMU sans l'enveloppe quickchr, voir la
compétence `routeros-qemu-chr`.

## La boucle de validation (patron central)

```ts
import { QuickCHR } from "@tikoci/quickchr";

const chr = await QuickCHR.start({ name: "lab", channel: "stable" });
// start() resolves REST-READY — provisioning is already done. No second wait needed
// in normal background/library use; waitForBoot() is only a belt-and-suspenders check.

await chr.exec("/ip/firewall/address-list/add list=blocked address=10.9.9.9");
const list = await chr.rest("/ip/firewall/address-list");   // structured read-back
// assert the entry is there → your config is grounded against real RouterOS

await chr.remove();   // tear down
```

`exec()` exécute une commande CLI (écritures de config, scripts) et retourne `{ output, via }` ;
`rest()` fait un appel REST et retourne le JSON parsé. Installation depuis npm (`bun add @tikoci/quickchr@0.5.2`)
ou CLI sans installation (`bunx @tikoci/quickchr@0.5.2 <cmd>`). Version fonctionnelle et exécutable :
[`examples/grounding/`](https://github.com/tikoci/quickchr/tree/main/examples/grounding).
Test de fumée minimal boot-et-lecture :
[`examples/quickstart/`](https://github.com/tikoci/quickchr/tree/main/examples/quickstart).
Tous les exemples sont des scripts `bun run` exécutables (`grounding/` est celui qui est en `bun:test`) ; l'ensemble
complet + carte de couverture est dans
[`examples/COVERAGE.md`](https://github.com/tikoci/quickchr/tree/main/examples/COVERAGE.md).

> **Astuce — sécurité de relance.** Donnez à chaque run un nom de machine unique et vérifiez des
> valeurs portant un nonce par run, pour qu'une machine périmée d'un run interrompu ne puisse pas
> faire passer à tort un run ultérieur pour réussi.

## Points d'entrée clés

Des pointeurs, pas des signatures dupliquées — la référence versionnée qui fait foi est le
[`MANUAL.md`](https://github.com/tikoci/quickchr/blob/main/MANUAL.md) de quickchr et
la JSDoc dans
[`src/lib/types.ts`](https://github.com/tikoci/quickchr/blob/main/src/lib/types.ts).
Voir aussi [`references/quickchr-api.md`](./references/quickchr-api.md) dans cette compétence.

| Besoin | Surface |
|---|---|
| Démarrer / créer une machine | `QuickCHR.start(opts)` → `ChrInstance` PRÊTE-REST |
| Choisir RouterOS | `channel` (`stable`/`long-term`/`testing`/`development`) **ou** `version` (`"7.23.1"`) ; si les deux, `version` gagne (avec un avertissement) |
| Revenir avant d'être prêt | `wait: false`, puis `instance.waitForBoot()` ; refusé avec des options de provisioning |
| Architecture | `arch:` — `"x86"` ou `"arm64"` |
| Login géré vs admin ouvert | `secureLogin: true` (utilisateur géré, vrai mot de passe) / `false` |
| Exécuter une commande CLI | `instance.exec(cmd, opts?)` — `opts.via` vaut `auto`/`rest`/`ssh`/`console`/`qga` |
| Appel REST | `instance.rest(path, init?)` |
| Déplacer des fichiers | `instance.upload(local, remote?)` / `instance.download(remote, local)` |
| Ajouter un paquet | `instance.installPackage(name)` (télécharge + reboote ; retourne les noms installés) |
| Redirections de ports perso | `extraPorts` / CLI `--forward` (voir Réseau) |
| NIC supplémentaires | `networks` / CLI `--add-network` (voir Réseau) |
| Surface de connexion pour un processus fils | `instance.subprocessEnv()` / `instance.descriptor()` |
| Instantanés | `instance.snapshot(...)` |
| Changer le device-mode après boot | `instance.setDeviceMode(opts)` (fait un power-cycle de la VM) |
| Démontage | `instance.stop()` (coupure électrique) / `instance.shutdown()` (arrêt invité d'abord) / `instance.remove()` / `instance.destroy()` |

Agents shell-first (terminal, réponses forum) : la compétence **routeros-quickchr-cli**
possède le cycle de vie CLI (`add`, `start`, `networks`, `cache`)
et le patron de pilotage `centrs --quickchr` — cette compétence ne le
répète pas. Patrons de dépendance bibliothèque (npm / `file:` / `bun link`) :
[`examples/README.md`](https://github.com/tikoci/quickchr/blob/main/examples/README.md).
CLI sans installation : `bunx @tikoci/quickchr@0.5.2 <cmd>`.

## Réseau — quel mécanisme pour quel trafic

La NIC `user` (SLIRP) par défaut gère l'administration (REST/SSH/WinBox via
redirection de ports hôte) et suffit à la plupart des validations. Ne la
dépassez que pour ces formes (guide complet par objectif :
[`docs/networking-recipes.md`](https://github.com/tikoci/quickchr/blob/main/docs/networking-recipes.md)) :

| Vous voulez… | Direction | Mécanisme |
|---|---|---|
| Atteindre un service TCP/UDP invité (REST, SSH, WinBox, SNMP, port de conteneur) | hôte → invité | NIC `user` + `hostfwd` (`--forward` / `extraPorts`) |
| Atteindre un service invité sur beaucoup de ports / ports dynamiques (ex. ports de données btest) | hôte → invité | plage `hostfwd` (`--forward name:9200-9210:2000-2010/udp`) |
| Recevoir l'UDP que **l'invité envoie** (syslog, NetFlow, TZSP, un serveur qui répond) | invité → hôte | l'invité envoie vers la passerelle `10.0.2.2:<port>` ; l'hôte lie un socket **non connecté** — **pas de redirection** |
| Recevoir des **trames L2 / broadcasts** invités (MNDP, MAC-Telnet, Ethernet brut) | invité ↔ hôte | NIC L2 `socket-connect` (l'hôte fait tourner un serveur TCP) |
| Lien L2 entre deux VM | VM ↔ VM | socket nommé `socket::<name>` (par défaut paire unix `dgram`, **chaque machine peut démarrer la première** ; `--mode mcast` c'est du multicast UDP — voir les pièges) ou une paire explicite `socket:listen:`/`socket:connect:` (le listener démarre en premier) |
| Présence LAN réelle / DHCP depuis l'hôte | L3 complet | `shared` ou `bridged:<iface>` |

Deux points non évidents à garder :

- **L'UDP invité → hôte n'a besoin d'aucune redirection.** La passerelle `10.0.2.2` *est* l'hôte
  vu depuis la VM. Un datagramme que l'invité envoie vers `10.0.2.2:<port>` atteint un socket
  hôte lié sur loopback — mais **laissez ce socket hôte non connecté** (`recvfrom`) :
  SLIRP le relaie depuis une source réécrite (`127.0.0.1:<ephemeral>`), donc un socket
  `connect()`-é le filtrerait. `instance.hostGatewayIp` (`10.0.2.2`) et
  `instance.captureInterface` (`lo0`/`any`) exposent les constantes. Exécutable :
  [`examples/udp-gateway/`](https://github.com/tikoci/quickchr/tree/main/examples/udp-gateway).
- **`user` termine la couche 2.** Pour MNDP/MAC-Telnet/broadcasts, ajoutez une
  NIC `socket-connect` — l'hôte fait tourner un serveur TCP, QEMU lui streame les
  trames invitées préfixées par leur longueur (rootless, loopback uniquement, multiplateforme). Recette + détail
  du wire : [`docs/mndp.md`](https://github.com/tikoci/quickchr/blob/main/docs/mndp.md) ;
  [`examples/mndp/`](https://github.com/tikoci/quickchr/tree/main/examples/mndp).
  Gardez `user` **en premier** (ether1) dans toute config multi-NIC — RouterOS ne fait
  son auto-DHCP que sur ether1, et `hostfwd` a besoin du `10.0.2.15` de l'invité.

## Piloter un outil externe contre un CHR live

Pour pointer un processus séparé vers un CHR en cours d'exécution (un extracteur de schéma, une suite de
protocoles, une CLI), utilisez la surface de connexion stable au lieu de lire `machine.json` :

```ts
const env = await chr.subprocessEnv();   // URLBASE, BASICAUTH, QUICKCHR_*
Bun.spawn(["my-tool"], { env: { ...process.env, ...env } });
```

`BASICAUTH` / `QUICKCHR_AUTH` sont la chaîne brute **`user:password`** (pas un
header) — encodez en base64 pour HTTP Basic : `Authorization: Basic ${btoa(env.BASICAUTH)}`.
`URLBASE` inclut déjà la base `/rest`. `descriptor()` donne la même surface
sous forme d'enregistrement structuré `{ urls, auth, ports, status, version }`. **Les deux portent
des secrets** — passez par env, ne loguez pas. Vérifiez toujours qu'une machine est `running`
avant d'utiliser des ports stockés. Exécutable :
[`examples/harness/`](https://github.com/tikoci/quickchr/tree/main/examples/harness).

## Faire tourner plusieurs CHR à la fois

Les créations concurrentes sont sûres (quickchr#190) :[^ground-lock]
les machines auto-allouées reçoivent des blocs de ports et des MAC de NIC distincts,
qu'elles viennent d'un seul processus ou de plusieurs. Un `portBase` explicite n'est jamais
déplacé : celui qui chevauche le bloc d'une autre machine est refusé avec
`PORT_CONFLICT`. Les appels de cycle de vie sur *une* machine sont ordonnés par un
verrou par machine. `stop()`, `clean()` et `remove()` attendent (jusqu'au
timeout de boot) une opération déjà en cours. L'exception est une machine
démarrée au premier plan : elle tient le verrou jusqu'à ce que sa VM
s'éteigne, donc ils échouent aussitôt à la place. Un second `start()` de la même
machine échoue aussi aussitôt. Les deux échecs sont `MACHINE_LOCKED`, et
le message nomme l'opération, le pid et l'âge du détenteur.

En 0.4.7, les *créations* concurrentes entraient en collision : deux
appels `QuickCHR.start()` dans un seul `Promise.all`, ou deux processus
`quickchr start`, pouvaient choisir le même bloc de ports auto-alloué, et un
QEMU échouait alors avec `SPAWN_FAILED` (*"Could not set up host
forwarding rule"*).[^ground-race] Pour les versions avant le correctif 0.5.0, créez les machines
une à la fois, ou donnez à chacune un `portBase` explicite espacé d'au moins 10.
Une fois créées, les machines peuvent tourner côte à côte.

## Pièges de validation et limitations connues

- **Plancher de provisioning :** login géré, installation de paquets et provisioning
  en écriture via `exec` exigent RouterOS **7.20.8+** ; le 7.x plus ancien est boot-only. quickchr
  démarre aussi RouterOS 6 (x86, CLI uniquement, pas de REST, pas de provisioning) : voir
  **routeros-quickchr-cli**.
- **Le provisioning ne tourne qu'une fois, au premier boot.** Les options de
  provisioning passées à `start()` sur une machine qui a déjà booté lèvent
  `PROVISIONING_WINDOW_CLOSED`, qui
  nomme la route qui marche encore (`setDeviceMode()`,
  `installPackage()`, ou `clean()` puis redémarrage). (En 0.4.8 elles
  étaient silencieusement ignorées.)[^window]
- **`BOOT_TIMEOUT` sur un redémarrage :** la 0.5.0 préserve une machine qui
  a déjà booté. Une machine créée par
  le même appel est toujours supprimée, et une machine créée par `add()` qui n'a jamais
  booté est réinitialisée. En 0.4.8 la machine était supprimée à la place, donc positionnez
  `QUICKCHR_PRESERVE_ON_FAILURE=1` là-bas avant de redémarrer une machine que vous
  avez configurée.[^boot-timeout]
- **QGA (`--via=qga`) exige KVM** — RouterOS ne démarre le guest agent que sous un
  hyperviseur KVM, donc indisponible sous HVF (macOS) et TCG. Utilisez REST/exec.
- **`socket-mcast` échoue silencieusement sur macOS et sous Linux restreint** (QEMU
  ne pose que `SO_REUSEADDR`, que BSD/macOS rejette pour le partage — et
  les bacs à sable filtrés par seccomp refusent le `sendto()` alors que rejoindre le groupe
  réussit). Il n'est pas non plus **confiné à l'hôte** (pas de `localaddr=`, donc le
  groupe emprunte l'interface multicast par défaut). Préférez `dgram` (le
  défaut) ou `socket:listen:`/`socket:connect:` pour deux machines ; n'utilisez
  `mcast` que pour du N-way avec un groupe à vous. Agents shell-first :
  voir la compétence **routeros-quickchr-cli** pour le cycle de vie CLI.
- **Le TCG cross-arch x86-sur-arm64 n'est pas viable** (l'émulation des E/S x86 est trop lente) ;
  aarch64-sur-x86 passe. KVM/HVF exigent la correspondance d'arch hôte/invité.
- **Le CHR gratuit est limité à 1 Mbps** — parfait pour valider config/API, pas
  pour les tests de débit. Un essai gratuit de 60 jours lève la limite.

> **Flakes :** ces exemples et recettes sont validés sur de vrais runs CHR. Si vous tombez sur
> un échec *non déterministe* (un boot qui coince, une erreur REST intermittente),
> relancez une fois ; si ça persiste, ouvrez une issue avec `qemu.log` sur
> <https://github.com/tikoci/quickchr/issues> plutôt que de contourner
> silencieusement.

## Docs de référence et compétences liées

- Dépôt quickchr : [README](https://github.com/tikoci/quickchr/blob/main/README.md) ·
  [MANUAL](https://github.com/tikoci/quickchr/blob/main/MANUAL.md) ·
  [DESIGN](https://github.com/tikoci/quickchr/blob/main/DESIGN.md) ·
  [docs/](https://github.com/tikoci/quickchr/tree/main/docs) ·
  [examples/](https://github.com/tikoci/quickchr/tree/main/examples)
- [`references/quickchr-api.md`](./references/quickchr-api.md) — carte API plus complète
  (options de start, méthodes/propriétés `ChrInstance`, plan de ports, codes d'erreur).
- **routeros-qemu-chr** — entrailles brutes du boot QEMU/CHR (VirtIO, UEFI/SeaBIOS,
  accélération) sous quickchr.
- **routeros-fundamentals** — CLI/REST/scripting RouterOS une fois le CHR levé.
- **routeros-sniffer** / **routeros-mndp** — capture TZSP et format du wire MNDP
  (les recettes UDP-passerelle et `socket-connect` ci-dessus les alimentent).

[^versions]: quickchr
    [`CHANGELOG.md`](https://github.com/tikoci/quickchr/blob/v0.5.2/CHANGELOG.md)
    `[0.5.0]` à `[0.5.2]` ;
    [revue du paquet 0.5.2](../routeros-quickchr-cli/references/cli-grounding.md#quickchr-052-package-review). Le comportement 0.5.0 décrit ici a été rejoué contre le paquet
    publié (`routeros-quickchr-cli/references/cli-grounding.md`
    §revérification 0.5.0 de quickchr).
[^window]: quickchr MANUAL.md §5 "Provisioning pipeline" ; CHANGELOG
    `[0.5.0]` Fixed (#176). L'ignor silencieux de la 0.4.8 est reproduit dans
    `routeros-quickchr-cli/references/cli-grounding.md` §Device-mode.
[^boot-timeout]: 0.5.0 : quickchr MANUAL.md §"Auto-cleanup on boot
    timeout" et CHANGELOG `[0.5.0]` (#182, #189). 0.4.8 :
    `cleanupAfterBootFailure()` dans `src/lib/quickchr.ts` au tag
    `v0.4.8` arrête QEMU, puis supprime la machine sauf si
    `QUICKCHR_PRESERVE_ON_FAILURE=1`.
[^ground-race]: [tikoci/quickchr#140](https://github.com/tikoci/quickchr/issues/140) :
    deux appels `QuickCHR.start()` concurrents sur quickchr 0.4.7 ont tous deux choisi
    `portBase=9140`, et le second QEMU a échoué `hostfwd=tcp::9145-:8291`
    avec `SPAWN_FAILED`. L'issue enregistre une seconde collision à 9100 et
    la cause : le bloc de ports est choisi avant toute prise de verrou.
[^ground-lock]: [tikoci/quickchr#190](https://github.com/tikoci/quickchr/pull/190),
    qui ferme #140, #180 et #181, livré en 0.5.0. Le
    [`MANUAL.md`](https://github.com/tikoci/quickchr/blob/main/MANUAL.md#static-methods-on-quickchr)
    (**Concurrency**) de quickchr énonce la garantie. Elle est couverte par les
    `test/unit/machine-lock-concurrency.test.ts` de quickchr (un `Promise.all` de
    quatre créations, plus trois processus démarrés au même instant, reçoivent
    des blocs distincts) et par un test live où deux starts concurrents
    bootent tous deux (`test/integration/start-stop.test.ts`, "concurrent starts").
