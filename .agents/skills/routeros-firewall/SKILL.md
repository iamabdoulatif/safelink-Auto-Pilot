---
name: routeros-firewall
description: "Configuration de filtre de pare-feu, NAT, mangle et listes d'adresses RouterOS. À utiliser pour : écrire des règles de pare-feu sous RouterOS, configurer le NAT, mettre en place des listes d'adresses ou d'interfaces, écrire des scripts de pare-feu idempotents, configurer la redirection DNS ou la redirection de ports, ou quand l'utilisateur mentionne /ip/firewall, chain=forward, chain=input, connection-state, address-list, interface-list ou layer7-protocol sur MikroTik."
---

# Pare-feu RouterOS

## Ordre des règles — séquentiel, pas basé sur la priorité

Les règles sont évaluées **de haut en bas** — la première correspondance gagne. C'est la plus grande source de confusion venant d'iptables.

- `place-before=0` insère en haut ; l'`add` par défaut ajoute en bas
- Une règle `action=accept` doit apparaître AVANT toute règle `action=drop` pour le même trafic
- **Les actions non terminales n'arrêtent PAS l'évaluation :** `action=add-src-to-address-list`, `action=add-dst-to-address-list`, `action=log` et toute règle avec `passthrough=yes` continuent vers la règle suivante. Une règle `drop` sous une règle `add-src-to-address-list` se déclenchera quand même.

```routeros
# WRONG — drop fires before accept can match
/ip/firewall/filter/add chain=input action=drop
/ip/firewall/filter/add chain=input src-address=10.0.0.1 action=accept

# CORRECT — accept first, drop catches the rest
/ip/firewall/filter/add chain=input src-address=10.0.0.1 action=accept place-before=0
/ip/firewall/filter/add chain=input action=drop
```

## Listes d'adresses comme sélecteurs dynamiques

Les LLM suggèrent rarement ce motif — ils écrivent une règle par adresse IP. Les listes d'adresses montent à des centaines d'IP avec une seule règle de pare-feu.

```routeros
# Build the list (static or dynamic with auto-expiry)
/ip/firewall/address-list/add list=trusted-mgmt address=192.168.1.0/24
/ip/firewall/address-list/add list=trusted-mgmt address=10.0.0.5 timeout=1h

# One rule handles all list members
/ip/firewall/filter/add chain=input src-address-list=trusted-mgmt action=accept \
  comment="myapp-accept-mgmt"
```

Les entrées dynamiques avec `timeout=` expirent automatiquement — le motif principal pour les listes noires anti-DoS.

## Listes d'interfaces comme sélecteurs de règles

`in-interface-list=` / `out-interface-list=` — motif RouterOS puissant que les LLM ne proposent jamais. Élimine les règles dupliquées quand plusieurs interfaces jouent le même rôle.

```routeros
# Define the group once
/interface/list/add name=WAN
/interface/list/member/add list=WAN interface=ether1
/interface/list/member/add list=WAN interface=pppoe-out1

# One rule applies to all WAN interfaces
/ip/firewall/filter/add chain=input in-interface-list=WAN action=drop \
  comment="myapp-drop-all-wan"
```

## Motif commentaire-étiquette (scripts idempotents)

RouterOS n'a pas de « upsert » — réexécuter un script sans nettoyage crée des règles dupliquées. Utilisez un préfixe de commentaire comme étiquette :

```routeros
# Remove only rules we own — preserves rules from other tools
/ip/firewall/filter/remove [find comment~"myapp-"]
/ip/firewall/address-list/remove [find comment~"myapp-"]
/ip/firewall/nat/remove [find comment~"myapp-"]

# Add with consistent tag — readable in /print output
/ip/firewall/filter/add chain=input src-address-list=trusted-mgmt action=accept \
  comment="myapp-accept-mgmt"
/ip/firewall/filter/add chain=input in-interface-list=WAN action=drop \
  comment="myapp-drop-wan"
```

**N'utilisez jamais `remove [find dynamic=no]`** — cela supprime TOUTES les règles statiques, y compris celles ajoutées par les outils de gestion. Certains outils (p. ex. OptiWize) marquent leurs règles avec `comment~"#orchestrator-*"` — un retrait massif casse silencieusement la gestion à distance.

## État des connexions

`connection-state=` de RouterOS n'est pas `-m state` d'iptables :

```routeros
/ip/firewall/filter/add chain=input connection-state=established,related action=accept
/ip/firewall/filter/add chain=input connection-state=invalid action=drop
```

États RouterOS : `new`, `established`, `related`, `invalid`, `untracked`.

`untracked` correspond aux paquets explicitement marqués via `/ip/firewall/raw action=notrack` — il ne correspond PAS aux flux FastTrack. FastTrack est un chemin rapide séparé qui garde les flux dans conntrack mais contourne mangle. Ne combinez jamais `fasttrack-connection` avec des marques de routage basées sur mangle sur le même trafic — les marques mangle ne sont pas appliquées aux paquets fasttrackés.

## Motifs NAT

```routeros
# Port forward (dst-nat)
/ip/firewall/nat/add chain=dstnat \
  dst-port=8080 protocol=tcp in-interface=ether1 \
  action=dst-nat to-addresses=192.168.1.10 to-ports=80 \
  comment="portfwd-web"

# Force DNS through router (prevents DNS bypass)
/ip/firewall/nat/add chain=dstnat action=redirect \
  in-interface-list=LAN dst-port=53 protocol=udp to-ports=53 \
  comment="force-dns-udp"
/ip/firewall/nat/add chain=dstnat action=redirect \
  in-interface-list=LAN dst-port=53 protocol=tcp to-ports=53 \
  comment="force-dns-tcp"

# Masquerade outgoing traffic
/ip/firewall/nat/add chain=srcnat action=masquerade \
  out-interface=ether1 comment="nat-wan"
```

## Protocole Layer7 (L7)

L7 correspond au contenu de charge utile non chiffrée avec une regex POSIX — gourmand en CPU, à utiliser avec parcimonie :

```routeros
/ip/firewall/layer7-protocol/add \
  name=captive-detect \
  regexp="^.*(gstatic|connectivitycheck|generate_204).*$" \
  comment="android-captive-portal"
```

Alternance L7 : `(a|b|c)` est correct. `(a)|(b)|(c)` a des bogues de précédence d'opérateurs ERE POSIX — la branche du milieu `(b)` correspond n'importe où dans le flux, sans ancrage. Utilisez la forme groupée avec `|` entre parenthèses uniquement.

## Erreurs courantes des LLM

| Erreur | Comportement RouterOS correct |
|---------|--------------------------|
| Utiliser `priority=` ou un poids de règle | Les règles sont séquentielles — l'ordre est la position, pas un poids |
| Écrire une règle par adresse IP | Utilisez `src-address-list=` ou `dst-address-list=` |
| `remove [find dynamic=no]` dans les scripts | Basé sur étiquettes : seulement `remove [find comment~"prefix-"]` |
| Oublier `place-before=` sur les règles accept | L'ajout par défaut met en fin — les règles accept sous les drops ne se déclenchent jamais |
| `connection-state=new,established` | États valides : `new`, `established`, `related`, `invalid`, `untracked` |
| `action=log` ou `passthrough=yes` arrête l'évaluation | Les actions non terminales continuent vers la règle suivante — un `drop` en dessous se déclenche quand même |
| Combiner fasttrack + marques de routage mangle | fasttrack contourne mangle — choisissez l'un ou l'autre |
| Alternance `(a)\|(b)\|(c)` dans la regex L7 | Utilisez `(a\|b\|c)` — forme groupée dans un seul jeu de parenthèses |
| Une règle de pare-feu par interface | Utilisez `in-interface-list=` avec une liste d'interfaces nommée |
| Trafic IPv6 géré par `/ip/firewall` | IPv6 utilise un `/ipv6/firewall` **séparé** — les règles ne s'appliquent pas entre protocoles |

## Ressources supplémentaires

**Skills liées :**

- `routeros-fundamentals` — syntaxe CLI RouterOS, API REST, bases du scripting
- `routeros-hotspot` — interaction entre la chaîne hotspot et le pare-feu, walled garden

**Fichiers de référence de cette skill :**

- [references/mangle-routing.md](./references/mangle-routing.md) — routage par stratégie avec marques de routage, sélecteur `hotspot=auth`
- [references/dos-protection.md](./references/dos-protection.md) — motifs anti-DoS `psd`, `tarpit`, `connection-limit`

**Outils MCP :**

- MCP `rosetta` — inspection de l'arbre de commandes `/ip/firewall` (`routeros_search`, `routeros_get_page`)

**Docs MikroTik :**

- [Firewall Filter](https://help.mikrotik.com/docs/display/ROS/Filter) — référence de la chaîne de filtrage
- [NAT](https://help.mikrotik.com/docs/display/ROS/NAT) — référence des actions NAT
- [Connection tracking](https://help.mikrotik.com/docs/display/ROS/Connection+tracking) — états des connexions
