---
name: routeros-diagnostics-monitoring
description: "À utiliser lorsqu'une liaison, un hôte ou un service se comporte mal sous RouterOS 7 et que vous devez localiser la panne, lors de la collecte de journaux ou de métriques depuis un routeur, de la mise en place d'alertes, ou de la mesure du débit (ping, traceroute, torch, sniffer, Netwatch, SNMP, traffic flow, graphing, bandwidth test, watchdog, Detect Internet)."
---

# Diagnostics et supervision RouterOS

## Aperçu

Commencez par l'outil le moins coûteux capable de répondre à la question. La plupart des outils ci-dessous modifient le comportement du routeur pendant leur exécution (sniffer et torch désactivent fast path et FastTrack, le test de débit sature la liaison), alors signalez-le avant de les exécuter sur un routeur de production et arrêtez-les après.

## Quand l'utiliser

- Une liaison, un hôte ou un service est lent, subit des pertes ou est en panne, et vous devez localiser la panne.
- Vous devez savoir ce qui s'est passé et quand (journaux), ou collecter des métriques dans le temps.
- Vous mettez en place des alertes (Netwatch, traps SNMP) ou mesurez le débit.

Quand NE PAS l'utiliser : la modification de la configuration (pare-feu, files d'attente, routage) appartient à la compétence qui possède ce domaine — voir les compétences liées ci-dessous.

## Référence rapide

| Question | Outil |
| --- | --- |
| L'hôte ou Internet est-il joignable ? | `/ping` (ajoutez `src-address`, `interface`, `vrf`, `count`) |
| Où le chemin se coupe-t-il, boucle-t-il ou ralentit-il ? | `/tool/traceroute` (utilisez `use-dns=yes` pour les noms) |
| Que s'est-il passé et quand ? | `/log/print`, `/system/logging` |
| Qui utilise la bande passante en ce moment ? | `/tool/torch <interface>` |
| Que se trouve exactement sur le câble ? | `/tool/sniffer` (enregistrez en pcapng pour Wireshark) |
| Un hôte ou un service est-il en panne (et agir en conséquence) ? | `/tool/netwatch` |
| Métriques à long terme | SNMP, `/ip/traffic-flow`, `/tool/graphing`, syslog |
| Quelle est la vitesse de la liaison ? | `/tool/speed-test`, `/tool/bandwidth-test` |
| CPU, mémoire, température, tension | `/system/resource`, `/tool/profile`, `/system/health` |
| Le routeur se bloque ou la liaison montante perdue doit le redémarrer | `/system/watchdog` |

## Ping et traceroute

```ros
/ping 1.1.1.1 count=3                                # internet; then a name to test DNS
/ping 198.51.100.10 size=1500 do-not-fragment count=2  # path MTU: lower size until replies arrive
/ping 192.168.2.10 src-address=192.168.88.1 count=3   # needed for IPsec or policy-routed tests
/tool/traceroute 198.51.100.10 count=3 use-dns=yes
```

- `size` compte tout le paquet IP (1500 équivaut à `ping -l 1472` sous Windows). Sans `do-not-fragment`, un gros ping est fragmenté et masque un problème de MTU. Un pare-feu qui abandonne les messages « fragmentation needed » transforme le symptôme en simples délais d'attente. Corrigez avec un ajustement MSS (`routeros-firewall`).
- Mots d'état : `timeout` (hôte en panne, ICMP filtré ou réponse plus lente que `interval`), `net unreachable` et `host unreachable` (le routeur dans `HOST` n'a pas de route ou refuse), `admin prohibited` (règle avec rejet), `TTL exceeded` (généralement une boucle de routage).
- `interface=` est nécessaire pour le ping ARP (hôtes qui bloquent ICMP), le ping ND et IPv6 link-local. `vrf=` n'accepte que de vrais VRF.
- Traceroute est de type `mtr` : sondes ICMP, jusqu'à 30 sauts, statistiques par saut. Une perte sur un saut qui ne se poursuit pas aux sauts suivants est une limitation de débit ICMP, pas une perte de chemin. Le même routeur qui se répète indique une boucle ; une fin silencieuse après un saut indique une route manquante ou une route de retour manquante.

## Journal

Les règles (`/system/logging`) sélectionnent par sujets et envoient vers une action (`/system/logging/action`) : mémoire (1000 lignes, perdues au redémarrage), disque, echo, distant (syslog), e-mail, script. Par défaut, `info`, `error`, `warning` sont conservés en mémoire et `critical` est affiché. Le débogage est désactivé.

```ros
/log/print where topics~"interface|dhcp"
/log/print follow-only where message~"login failure"
/system/logging/action/add name=dhcpdebug target=memory memory-lines=2000    # debug into its own buffer
/system/logging/add topics=dhcp,debug action=dhcpdebug
/log/print where buffer=dhcpdebug
/system/logging/action/set remote remote=192.0.2.10 remote-log-format=syslog
/system/logging/add topics=info action=remote
```

- Une règle correspond aux entrées qui possèdent **tous** ses sujets : `topics=info,warning` ne correspond à rien. Utilisez une règle par sujet. `!` exclut un sujet.
- Les journaux de débogage peuvent contenir des secrets (`ssh,debug` journalise les clés de session). Conservez-les dans un tampon local, ne les envoyez jamais vers syslog ni par e-mail.
- Formats syslog : `default`, `syslog` (RFC 3164 uniquement), `cef`. Sur TCP et TLS, utilisez `cef` (les autres n'ont pas de délimiteur de message). Avec TLS, `check-certificate=yes` vérifie l'autorité de certification mais pas le nom du serveur. Réglez `syslog-time-format=iso8601` entre fuseaux horaires et gardez NTP à l'heure (`routeros-system-utilities`). Les noms d'actions n'acceptent que lettres et chiffres.
- Les actions e-mail envoient un courrier par entrée ; une attaque par force brute inonde la boîte aux lettres, alors bloquez les attaques dans le pare-feu. Une action de script lit `$topics` et `$message` ; l'exemple du manuel collecte les sources d'échecs de connexion dans une liste d'adresses.
- Les entrées apparaissent deux fois dans `/log/print` quand plusieurs actions les stockent : ajoutez `where buffer=memory`.

## Sniffer et torch

```ros
/tool/sniffer/start interface=bridge ip-address=192.168.88.50/32      # capture on the LAN side, before NAT hides the host
/tool/sniffer/stop
/tool/sniffer/save file-name=capture.pcap                            # pcapng, open in Wireshark
/tool/sniffer/quick interface=ether1 port=bootps,bootpc duration=10s
/tool/torch bridge src-address=192.168.88.21/32
```

- Le sniffer voit les paquets reçus avant le pare-feu et les paquets envoyés après lui, donc les abandons apparaissent comme reçus uniquement. Le trafic de pont avec déchargement matériel (hardware-offloaded) n'atteint jamais le CPU, il est donc invisible pour les deux outils (`routeros-bridging-switching`). Les filtres se combinent avec ET entre filtres différents. La mémoire est de 100 Kio par défaut ; `memory-scroll=yes` conserve les paquets les plus récents. Les captures contiennent du trafic utilisateur : traitez les fichiers comme privés.
- Le streaming TZSP (`streaming-enabled=yes streaming-server=... filter-stream=yes`) envoie les trames non chiffrées sur UDP 37008.
- Torch : `src-address` est le côté distant de l'interface surveillée, donc sur une interface LAN filtrez les hôtes avec `src-address`. `RX` est ce que l'interface reçoit depuis cette adresse. Il montre le trafic abandonné par le pare-feu (côté entrée), ce qui aide à décider si une règle ou le chemin est en cause.

## Netwatch

```ros
/tool/netwatch/add name=wan-dns host=1.1.1.1 type=icmp thr-avg=100ms interval=10s \
    up-script=":log info \"wan up\"" down-script=":log warning \"wan down\""
/tool/netwatch/print stats
```

Types : `simple` (intervalle par défaut 60 s), `icmp`, `tcp-conn`, `http-get`, `https-get`, `dns`. Les scripts s'exécutent comme un utilisateur interne restreint avec uniquement les politiques `read`, `write`, `test`, `reboot` et ont des globales privées. Les sondes ICMP ont des seuils par défaut (par exemple `thr-avg=100ms`), donc une liaison lente est signalée en panne. `http-get` est en panne sur une redirection sauf `http-codes=100-399`. Après un redémarrage, les sondes attendent `startup-delay` (5 m).

## SNMP

```ros
/snmp/set enabled=yes contact="NOC" location="Server room"
/snmp/community/add name=monit addresses=192.0.2.0/24 security=none read-access=yes
/snmp/community/set [find name=public] addresses=192.0.2.0/24     # or remove it
/snmp/set trap-target=192.0.2.50 trap-community=monit trap-version=2 trap-generators=interfaces
```

La communauté `public` par défaut est lisible depuis n'importe quelle adresse. `security=authorized|private` signifie SNMPv3 (les sondages v1/v2c restent sans réponse), avec des mots de passe d'au moins 8 caractères. Une requête hors de `addresses` reste sans réponse. `write-access=yes` permet de changer l'identité, d'exécuter des scripts et de redémarrer : uniquement en v3 ou sur un sous-réseau restreint. `print oid` dans n'importe quel menu liste les OID. Testez avec `/tool/snmp-get`.

## Export de flux, graphiques, ressources

```ros
/ip/traffic-flow/set enabled=yes
/ip/traffic-flow/target/add dst-address=192.168.0.2 port=2055 version=9
/ip/traffic-flow/monitor duration=3
/tool/graphing/interface/add interface=ether1 allow-address=192.168.88.10/32
/tool/graphing/resource/add allow-address=192.168.88.10/32
/system/resource/print
/tool/profile cpu=all freeze-frame-interval=1 duration=5
```

- Traffic Flow exporte NetFlow v1, v5, v9 ou IPFIX sur UDP ; le trafic avec déchargement matériel n'est pas compté. Les graphiques sont sur `http://router/graphs/` sans identifiant : définissez toujours `allow-address` (par défaut, toutes les adresses IPv4) et gardez la page hors du WAN.
- Compteurs d'interfaces : `/interface/print stats`, `monitor-traffic`, et `/tool/traffic-monitor` pour exécuter un script quand un débit franchit un seuil. Des compteurs réguliers en hausse avec des compteurs `fp-*` plats signifient que le trafic quitte le fast path.
- Santé (`/system/health`) montre température, tension, ventilateurs ; les traps de seuils nécessitent `trap-generators=temp-exception`.

## Tests de débit

`/tool/speed-test address=<peer> test-duration=5s` (latence, gigue, TCP et UDP dans les deux sens) et `/tool/bandwidth-test` nécessitent un pair RouterOS avec `/tool/bandwidth-server` activé, un utilisateur dans un groupe avec les politiques `test` et `winbox`, le mode appareil `bandwidth-test` activé, TCP 2000 et UDP 2000-65535 autorisés, et pour la réception UDP le client doit accepter les paquets du serveur. Limitez `local-tx-speed` et `remote-tx-speed` sur les liaisons actives. Supprimez ensuite l'utilisateur de test et les règles de pare-feu. `flood-ping` et le générateur de trafic nécessitent le drapeau de mode appareil `traffic-gen`.

## Watchdog et Detect Internet

`/system/watchdog` redémarre un routeur bloqué (`watchdog-timer=yes`) et, quand `watch-address` est défini, un routeur dont l'adresse de liaison montante cesse de répondre à six pings. Choisissez une adresse à l'intérieur du tunnel ou de l'autre côté de la liaison, réglez `ping-start-after-boot` plus long que le temps d'établissement de la liaison, et gardez un autre moyen d'accès : une mauvaise adresse signifie un redémarrage toutes les quelques minutes. `/interface/detect-internet` remplit des listes dynamiques (`internet`, `wan`, `lan`) à partir des contrôles de route et du cloud MikroTik ; les listes changent d'elles-mêmes, ne les utilisez donc pas dans des règles d'acceptation.

## Erreurs courantes

| Erreur | Pourquoi c'est nuisible |
|---|---|
| `topics=info,warning` dans une seule règle de journalisation | Une règle correspond aux entrées possédant **tous** les sujets — cela ne correspond à rien ; utilisez une règle par sujet |
| Syslog sur TCP/TLS avec le format `default` | Pas de délimiteur de message ; utilisez `cef`, et rappelez-vous que TLS vérifie l'autorité de certification mais pas le nom du serveur |
| Laisser la communauté SNMP `public` ouverte | Lisible depuis n'importe quelle adresse ; restreignez `addresses` ou supprimez-la |
| Graphiques sans `allow-address` | `http://router/graphs/` n'a pas d'identifiant et vaut par défaut toutes les adresses IPv4 |
| Netwatch `http-get` sur une URL avec redirection | Signalé en panne ; autorisez les redirections avec `http-codes=100-399` |
| Listes Detect Internet dans des règles d'acceptation | Les listes changent d'elles-mêmes au fil des contrôles |

## Où chercher

| Besoin | Ouvrir |
| --- | --- |
| Liste des sujets de journaux, syslog TLS, fichiers disque, actions de script | `references/guides/diagnostics-monitoring-and-troubleshooting/log.md` |
| Ping, traceroute, torch, sniffer | `ping.md`, `traceroute.md`, `torch.md`, `packet-sniffer.md` dans le même dossier |
| Netwatch, SNMP, traffic flow, graphing | `netwatch.md`, `snmp.md`, `traffic-flow.md`, `graphing.md` |
| Test de débit, test de vitesse, générateur de trafic | `bandwidth-test.md`, `speed-test.md`, `traffic-generator.md` |
| Ressources, profileur, santé, watchdog, detect internet | `resource.md`, `profiler.md`, `health.md`, `watchdog.md`, `detect-internet.md` |
| Propriétés | `references/cli/tool/`, `references/cli/system/logging/`, `references/cli/snmp/`, `references/cli/ip/traffic-flow/` |
| Tout le reste | `references/INDEX.md` |

Compétences liées : `routeros-troubleshooting` (supout.rif et support), `routeros-system-utilities` (horloge, planificateur, e-mail), `routeros-firewall` (compteurs, règles de journalisation), `routeros-scripting`, `routeros-hardware` (capteurs et PoE), `routeros-queues` (graphiques des files d'attente).
