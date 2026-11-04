---
name: routeros-fundamentals
description: "Connaissances du domaine RouterOS v7 pour les agents IA. À utiliser lorsque : vous travaillez avec MikroTik RouterOS, écrivez des commandes CLI/script RouterOS, appelez l'API REST de RouterOS, déboguez pourquoi une commande Linux échoue sur RouterOS, ou lorsque l'utilisateur mentionne MikroTik, RouterOS, CHR, ou les chemins /ip /system /interface. Portée : RouterOS 7.x (long-term et versions plus récentes) uniquement — la v6 n'est PAS couverte et la précision pour les problèmes v6 sera faible."
---

# Fondamentaux de RouterOS

## RouterOS n'est PAS GNU/Linux

RouterOS utilise un noyau Linux (5.6.3) mais **tout ce qui se trouve au-dessus du noyau est le système propriétaire `nova` de MikroTik**. C'est le fait le plus important à intégrer pour les agents.

**Ce qui n'existe PAS sur RouterOS :**

- Pas de `/bin`, `/usr`, `/etc`, `/var` — pas de disposition FHS
- Pas de bash, sh, ash, zsh — aucun shell Unix
- Pas de coreutils (`ls`, `cat`, `grep`, `ps`, `mount`, `ip`, `iptables`, etc.)
- Pas de glibc, musl, busybox
- Pas d'apt, pkg, opkg — pas de gestionnaire de paquets (les paquets sont des fichiers `.npk` installés par téléversement + redémarrage)
- Pas de `systemctl`, `service`, système d'init
- Pas de `/proc` ni `/sys` accessibles depuis l'espace utilisateur
- Pas de `docker`, `podman` — RouterOS possède son propre sous-système `/container` (7.x+)

**Ce qui existe :**

- Le CLI RouterOS — son propre langage, pas un shell. Accessible via SSH, série, WinBox ou WebFig
- L'API REST à `/rest/` (HTTP, port 80 par défaut) — l'interface programmatique principale
- Le langage de script RouterOS (fichiers `.rsc`) — sa propre syntaxe, pas du bash. Voir la compétence `routeros-scripting` et la [référence de script](./references/scripting.md)
- WebFig (interface web) sur le port 80
- Le protocole WinBox sur le port 8291

**Erreurs courantes des agents à éviter :**

- N'essayez PAS `ssh admin@host 'ls /'` — cela ouvre le CLI RouterOS, pas un shell
- Ne suggérez PAS `mount`, `fdisk`, `mkfs` — utilisez plutôt les commandes `/disk`
- Ne cherchez PAS de fichiers de configuration dans `/etc/` — la configuration se trouve dans la base de données RouterOS
- Ne supposez PAS que `ping` fonctionne de la même façon — c'est `/tool/ping` ou `/ping` dans le CLI
- Ne suggérez PAS d'installer des paquets via `apt` ou `opkg` — téléversez le fichier `.npk` via SCP puis `/system/package/apply-changes` (7.18+) ou `/system/reboot` (<7.18)
- Voir la [référence des paquets supplémentaires](./references/extra-packages.md) pour la liste complète des paquets et le modèle d'installation

## Syntaxe du CLI RouterOS

Le CLI RouterOS utilise une navigation par chemins, pas des pipelines de commandes Unix :

```routeros
# Navigation
/ip/address/print
/interface/print
/system/resource/print

# Adding entries
/ip/address/add address=192.168.1.1/24 interface=ether1

# Modifying (by internal ID or find expression)
/ip/address/set [find interface=ether1] address=10.0.0.1/24

# Removing
/ip/address/remove [find address="192.168.1.1/24"]

# Running a command
/system/reboot
/tool/fetch url="http://example.com/file.npk" dst-path="/"
```

**Principales différences de syntaxe par rapport au shell :**

- `=` assigne les propriétés (sans espaces autour)
- `[find ...]` est l'expression de requête (équivalent de WHERE)
- Les numéros de ligne du `print` interactif ne sont pas des identifiants d'objets utilisables en script ; utilisez `[find ...]` ou les identifiants internes `*HEX`
- Les chaînes utilisent `""` (guillemets doubles uniquement)
- Les commentaires utilisent `#`
- Variables : `:local myVar "value"` et `$myVar`
- Pas de tubes (pipes), pas de redirection, pas de sous-shell

## API REST

L'API REST de RouterOS se trouve à `http://HOST:PORT/rest/`. Les verbes HTTP sont mappés de façon non standard :

| HTTP | Action RouterOS | Équiv. CLI |
|---|---|---|
| `GET` | print (liste/lecture) | `/path/print` |
| `PUT` | **add (création)** | `/path/add` |
| `PATCH` | set (mise à jour) | `/path/set` |
| `DELETE` | remove | `/path/remove` |
| `POST` | command (exécution) | `/path/command` |

**Pièges principaux :**

- `PUT` crée (ne met PAS à jour) — à l'inverse de nombreuses API REST
- Authentification avec mot de passe vide : `admin:` (les deux-points sont requis, rien après)
- La racine WebFig (`GET /`) renvoie HTTP 200 sans authentification — à utiliser comme contrôle de santé
- L'API REST (`/rest/`) exige une authentification (HTTP 401 sans elle)
- Le champ `.id` est au format `*HEX` (p. ex. `*1`, `*A`)

Voir la [référence de l'API REST](./references/rest-api-patterns.md) pour les modèles complets, la gestion des erreurs, le filtrage, les commandes POST et `/console/inspect`.

## Schéma de versions

Format : `MAJOR.MINOR[.PATCH][betaN|rcN]` — p. ex. `7.22`, `7.22.1`, `7.23beta2`, `7.22rc1`

**Canaux :** `stable` / `long-term` / `testing` / `development`

Point de terminaison des versions (texte brut) : `https://upgrade.mikrotik.com/routeros/NEWESTa7.<channel>`

Pour l'analyse des versions, la comparaison, les URL de téléchargement et le nommage des paquets : voir la [référence d'analyse des versions](./references/version-parsing.md).

## Noms d'architectures

MikroTik utilise ces identifiants d'architecture (et non les noms d'arch Linux standards) :

| Nom MikroTik | CPU | Matériel courant |
|---|---|---|
| `x86` | x86_64 | CHR, RouterBOARDs à base de x86 |
| `arm64` | aarch64 | Cartes ARM modernes (RB5009, Chateau) |
| `arm` | ARMv7 | Anciennes cartes ARM |
| `mipsbe` | MIPS big-endian | RouterBOARDs hérités |
| `mmips` | MIPS multicœur | hAP ac, RB4011 |
| `smips` | MIPS monocœur | hAP lite, mAP |
| `ppc` | PowerPC | Série CCR1xxx |
| `tile` | Tilera | CCR (anciens modèles) |

CHR (Cloud Hosted Router) n'est disponible que pour `x86` et `arm64`.

## Identifiants par défaut

- Nom d'utilisateur : `admin`
- Mot de passe : (vide — aucun mot de passe)
- Lors de la première connexion via SSH/console, RouterOS 7.x propose de définir un mot de passe ou d'appuyer sur `a` pour passer
- L'API REST et WebFig autorisent l'accès avec un mot de passe vide

## Inspection du matériel depuis le CLI RouterOS

```routeros
# PCI devices (the RouterOS equivalent of lspci)
/system/resource/hardware/print

# IRQ assignments (shows driver binding)
/system/resource/irq/print

# System overview
/system/resource/print

# Disk info
/disk/print

# Installed packages
/system/package/print

# IP services and ports
/ip/service/print

# Network interfaces
/interface/print
```

## Ressources supplémentaires

**Fichiers de référence :**

- Nouveau manuel officiel : <https://manual.mikrotik.com/>. Le nouveau site remplace l'ancienne documentation `help.mikrotik.com` basée sur Confluence et comprend une section de référence CLI à <https://manual.mikrotik.com/docs/CLI%20Reference/>.
- Pour les détails de l'API REST et l'arborescence de commandes `/console/inspect` : voir la [référence de l'API REST](./references/rest-api-patterns.md)
- Pour l'analyse des versions, la comparaison et la logique des URL de téléchargement : voir la [référence d'analyse des versions](./references/version-parsing.md)
- Pour les paquets supplémentaires (container, iot, zerotier, etc.) : voir la [référence des paquets supplémentaires](./references/extra-packages.md)
- Pour le mode appareil (modes, matrice des fonctionnalités, confirmation physique) : voir la [référence du mode appareil](./references/device-mode.md)
- Pour la syntaxe du langage de script RouterOS : voir la [référence de script](./references/scripting.md)
- Pour la gestion des utilisateurs, les clés SSH, le compte admin : voir la [référence REST des utilisateurs](./references/routeros-users-rest.md)
- Pour l'adressage IP, le routage, DHCP, DNS, les interfaces : voir la [référence REST du réseau](./references/routeros-networking-rest.md)
- Pour le pare-feu filter/NAT/mangle et l'ordre des règles : voir la [référence REST du pare-feu](./references/routeros-firewall-rest.md)
- Pour les bogues du runtime Bun affectant HTTP (req.destroy, pool, secrets) : voir les [pièges du runtime Bun](./references/bun-runtime-gotchas.md)

**Compétences associées :**

- Pour le script RouterOS et les pièges de l'automatisation de configuration `.rsc`/CLI : voir la compétence `routeros-scripting`
- Pour le sous-système /container (VETH, mode appareil, cycle de vie) : voir la compétence `routeros-container`
- Pour netinstall-cli et le flashage des appareils : voir la compétence `routeros-netinstall`
- Pour le format de conteneur /app YAML (7.22+) : voir la compétence `routeros-app-yaml`
- Pour la traversée d'arborescence /console/inspect et la génération de schéma : voir la compétence `routeros-command-tree`
- Pour l'exécution de CHR sous QEMU (local ou CI) : voir la compétence `routeros-qemu-chr`
- Pour la capture de paquets, /tool/sniffer et le streaming TZSP : voir la compétence `routeros-sniffer`

**Outils MCP :**

- Pour parcourir l'arborescence des commandes et rechercher des propriétés : utilisez les outils du serveur MCP `rosetta` (`routeros_search`, `routeros_get_page`, `routeros_command_tree`)
