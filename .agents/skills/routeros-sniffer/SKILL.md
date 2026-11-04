---
name: routeros-sniffer
description: "Capture de paquets RouterOS et streaming TZSP pour le débogage de protocoles. À utiliser lorsque : vous capturez des paquets sur RouterOS, configurez /tool/sniffer, diffusez du trafic en direct via TZSP, utilisez l'action mangle firewall sniff-tzsp, déboguez des protocoles réseau sur MikroTik, recevez TZSP avec Wireshark ou tshark, enregistrez des fichiers pcap depuis RouterOS, ou lorsque l'utilisateur mentionne renifleur de paquets, TZSP, sniff-tzsp, /tool/sniffer, ou capture de paquets sur RouterOS."
---

# Capture de paquets RouterOS et streaming TZSP

RouterOS intègre un renifleur de paquets (`/tool/sniffer`) et des actions mangle du firewall capables de refléter le trafic — soit en l'enregistrant dans un fichier sur le routeur, soit en le diffusant en direct vers un hôte distant via TZSP (TaZmen Sniffer Protocol). C'est la principale façon de capturer des paquets sur RouterOS, car les outils standards comme `tcpdump` n'existent pas (voir la compétence `routeros-fundamentals`).

## Pourquoi c'est important pour les agents

Pour déboguer tout problème de protocole réseau sur RouterOS, les agents doivent savoir qu'ils peuvent :

1. **Diffuser des paquets en direct** du routeur vers la machine hôte via TZSP — aucun matériel nécessaire avec une VM CHR
2. **Enregistrer des fichiers pcap/pcapng** sur la flash du routeur et les télécharger pour analyse
3. **Utiliser des règles mangle du firewall** pour refléter chirurgicalement des flux précis sans toucher à la configuration du renifleur

Combiné à une instance CHR sous QEMU (voir la compétence `routeros-qemu-chr`), cela donne aux agents un flux de débogage complet au niveau paquet sans aucun matériel physique.

## Méthode 1 : /tool/sniffer (outil de capture complet)

Le renifleur intégré capture les paquets sur les interfaces spécifiées avec un filtrage étendu. Il prend en charge **trois modes de sortie indépendants** qui peuvent être combinés :

| Sortie | Paramètre | Notes |
|--------|--------|-------|
| Tampon mémoire | (toujours actif) | Visible via les sous-menus `quick`, `packet`, `protocol`, `host`, `connection`. Paquets disponibles pendant 10 minutes |
| Fichier sur la flash | `file-name=capture.pcap` | Format PCAPNG depuis RouterOS 7.20 |
| Flux TZSP | `streaming-enabled=yes` | UDP vers `streaming-server` sur `streaming-port` (défaut 37008) |

### Streaming TZSP en direct

```routeros
# Configure sniffer to stream via TZSP to a remote host
/tool/sniffer
set streaming-enabled=yes streaming-server=<RECEIVER-IP>:37008

# Optional: filter to a specific interface or protocol
set filter-interface=ether1
set filter-ip-protocol=icmp

# Start capture (runs until stopped or router reboots)
/tool/sniffer/start

# Stop when done
/tool/sniffer/stop
```

L'hôte récepteur exécute Wireshark, tshark ou un autre outil compatible TZSP (voir la [référence des récepteurs TZSP](./references/tzsp-receivers.md)).

### Capture dans un fichier

```routeros
# Capture to file on router flash
/tool/sniffer
set file-name=capture.pcap filter-interface=ether1

/tool/sniffer/start
# ... let it capture ...
/tool/sniffer/stop

# Or save the memory buffer to a file manually
/tool/sniffer/save file-name=/flash/debug.pcap

# Download via SCP or fetch
# From the host:
# scp admin@<ROUTER-IP>:/flash/debug.pcap .
```

Fichier + streaming peuvent fonctionner simultanément :

```routeros
/tool/sniffer
set file-name=capture.pcap streaming-enabled=yes streaming-server=<RECEIVER-IP>:37008
/tool/sniffer/start
```

### Mode rapide (CLI interactif)

Pour une inspection ponctuelle rapide directement sur la console du routeur :

```routeros
# Quick-capture ICMP traffic on ether1
/tool/sniffer/quick ip-protocol=icmp interface=ether1
```

Cela affiche un tableau défilant en direct sur la console avec les MAC source/dest, IP, protocole et taille.

### Propriétés de filtrage du renifleur

Options clés de filtrage pour `/tool/sniffer/set` :

| Propriété | Description |
|----------|-------------|
| `filter-interface` | Nom d'interface ou `all` (défaut : `all`) |
| `filter-ip-address` | Jusqu'à 16 entrées IP/masque |
| `filter-dst-ip-address` | Jusqu'à 16 entrées IP/masque de destination |
| `filter-src-ip-address` | Jusqu'à 16 entrées IP/masque source |
| `filter-port` | Jusqu'à 16 ports (prend en charge la négation `!`) |
| `filter-ip-protocol` | Jusqu'à 16 protocoles (tcp, udp, icmp, etc.) |
| `filter-mac-protocol` | Jusqu'à 16 protocoles MAC (ip, arp, ipv6, vlan, etc.) |
| `filter-direction` | `any`, `rx` ou `tx` |
| `filter-stream` | `yes`/`no` — exclut les propres paquets TZSP du renifleur (défaut : yes) |
| `filter-vlan` | Jusqu'à 16 ID de VLAN |
| `memory-limit` | Taille du tampon mémoire (défaut : 100 Kio) |
| `file-limit` | Taille max. du fichier (défaut : 1000 Kio) |
| `only-headers` | Enregistre uniquement les en-têtes de paquets, pas la charge utile complète |

**Important :** `filter-stream=yes` (défaut) exclut de la capture les propres paquets de flux TZSP du renifleur — laissez-le activé pour éviter les boucles de rétroaction.

## Méthode 2 : Mangle du firewall (miroir ciblé)

Les règles mangle du firewall offrent **un miroir granulaire par flux** utilisant tout le moteur de correspondance du firewall. Deux actions liées au sniffing existent :

### action=sniff-tzsp (diffusion vers un récepteur TZSP distant)

Reflète les paquets correspondants en TZSP vers un hôte distant. Utilise tout le moteur de correspondance du firewall (adresse src/dst, protocole, port, état de connexion, interface, etc.) :

```routeros
# Mirror all forwarded ICMP to a TZSP receiver
/ip/firewall/mangle
add action=sniff-tzsp chain=forward protocol=icmp \
    sniff-target=<RECEIVER-IP> sniff-target-port=37008 \
    comment="TZSP mirror ICMP to Wireshark"

# Mirror traffic from a specific host
/ip/firewall/mangle
add action=sniff-tzsp chain=forward src-address=192.168.88.100 \
    sniff-target=<RECEIVER-IP> sniff-target-port=37008

# Mirror DNS queries
/ip/firewall/mangle
add action=sniff-tzsp chain=forward protocol=udp dst-port=53 \
    sniff-target=<RECEIVER-IP> sniff-target-port=37008
```

Propriétés pour `sniff-tzsp` :

- `sniff-target` (IP) — IP de destination pour les paquets UDP TZSP
- `sniff-target-port` (port, défaut 37008) — port UDP de destination
- `sniff-id` — étiquette d'identifiant facultative

**Comportement clé :** `sniff-tzsp` agit comme `passthrough` — après correspondance, le paquet passe à la règle mangle suivante. Le paquet d'origine n'est NI modifié NI abandonné ; seule une copie est envoyée en TZSP.

### Mangle vs /tool/sniffer : quand utiliser lequel

| Scénario | Utiliser |
|----------|-----|
| Capturer tout le trafic d'une interface | `/tool/sniffer` |
| Refléter des flux précis (par IP, port, protocole) | Mangle `sniff-tzsp` |
| Enregistrer un fichier pcap sur la flash du routeur | `/tool/sniffer` avec `file-name` |
| Diffuser en direct vers Wireshark/tshark | L'un ou l'autre — `/tool/sniffer` avec `streaming-enabled` ou mangle `sniff-tzsp` |
| Miroirs multiples indépendants vers différents récepteurs | Règles mangle (une par cible) |
| Vue CLI interactive rapide | `/tool/sniffer/quick` |

## Aperçu du protocole TZSP

TZSP est une simple encapsulation UDP — le routeur enveloppe la trame Ethernet d'origine dans un en-tête TZSP et l'envoie comme un datagramme UDP :

```text
UDP (port 37008) → TZSP header (4 bytes) → tags (variable) → TAG_END → original Ethernet frame
```

- **Port par défaut :** 37008 (`0x9090`) — non enregistré auprès de l'IANA mais le standard RouterOS/Wireshark
- **Encapsulation :** typiquement Ethernet (type 1) ; 802.11 pour les captures sans fil
- **Étiquettes :** métadonnées facultatives (puissance du signal WLAN, canal, etc.) ; les captures Ethernet n'ont généralement pas d'étiquettes
- **Keepalives :** paquets de type 4 (Null) envoyés périodiquement — sans trame intérieure, filtrez-les lors du traitement

## Modèle de test CHR

Une instance CHR sous QEMU fournit un labo complet de capture de paquets sans aucun matériel. La licence CHR gratuite a une **limite de débit de 1 Mbps** mais elle suffit pour le débogage de protocoles et les tests du renifleur.

```sh
# 1. Boot a CHR instance with port forwarding for REST API and SSH
qemu-system-x86_64 -M q35 -m 256 \
  -drive file=chr.img,format=raw,if=virtio \
  -netdev user,id=net0,hostfwd=tcp::9180-:80,hostfwd=tcp::9122-:22 \
  -device virtio-net-pci,netdev=net0 \
  -display none -serial stdio

# 2. Configure sniffer via REST API once booted
curl -u admin: -X POST http://<router-ip>/rest/tool/sniffer/set \
  -H 'Content-Type: application/json' \
  -d '{"streaming-enabled":"yes","streaming-server":"10.0.2.2:37008"}'

# 3. Start capture
curl -u admin: -X POST http://<router-ip>/rest/tool/sniffer/start

# 4. Listen for TZSP on the host
tshark -i any -f "udp port 37008" -O tzsp

# 5. Generate test traffic (e.g., ping from the CHR)
curl -u admin: -X POST http://<router-ip>/rest/ping \
  -H 'Content-Type: application/json' \
  -d '{"address":"8.8.8.8","count":"3"}'
```

**Remarque sur le réseau en mode utilisateur QEMU :** la passerelle par défaut du CHR (10.0.2.2) est l'hôte. Utilisez cette IP comme `streaming-server` avec QEMU `-netdev user`. L'hôte doit écouter sur toutes les interfaces (ou spécifiquement sur 10.0.2.2) pour recevoir les paquets TZSP.

Pour tous les détails de configuration QEMU, voir la compétence `routeros-qemu-chr`. Pour les détails de licence CHR (offre gratuite, essai de 60 jours, limites de débit), voir [Licence CHR](../routeros-qemu-chr/references/chr-licensing.md).

## Pièges

- **Le trafic ponté avec accélération matérielle** n'est PAS visible par le renifleur — seuls les paquets inondés (unicast inconnu, broadcast, multicast) peuvent apparaître
- **Le trafic unicast client-à-client sans fil** avec le transfert activé n'est PAS visible
- **Les paquets reniflés en mémoire expirent après 10 minutes** — enregistrez dans un fichier ou utilisez le streaming pour une capture persistante
- **Le format PCAPNG** (RouterOS 7.20+) est le défaut pour les fichiers enregistrés — les outils plus anciens peuvent exiger du PCAP
- **`filter-stream=yes`** (défaut) est important — sans lui, le renifleur capture ses propres paquets de flux TZSP, créant une boucle de rétroaction
- **La limite de 1 Mbps du CHR** peut donner des captures « lentes » — c'est la limite de la licence gratuite, pas un problème du renifleur. Voir [Licence CHR](../routeros-qemu-chr/references/chr-licensing.md)
- **`file-limit` ne doit pas dépasser la mémoire libre** — le routeur peut planter ou se comporter de façon inattendue

## Nettoyage

Nettoyez toujours la configuration du renifleur et les règles mangle après le débogage :

```routeros
# Stop sniffer
/tool/sniffer/stop

# Reset sniffer config to defaults
/tool/sniffer
set streaming-enabled=no streaming-server=0.0.0.0 file-name=""

# Remove mangle rules (find by comment)
/ip/firewall/mangle/remove [find comment~"TZSP"]
```

## Ressources supplémentaires

**Fichiers de référence :**

- Pour la configuration des récepteurs TZSP (Wireshark, tshark, tcpdump) : voir la [référence des récepteurs TZSP](./references/tzsp-receivers.md)

**Compétences associées :**

- Pour la configuration QEMU CHR et les modèles de démarrage : voir la compétence `routeros-qemu-chr`
- Pour la licence CHR (offre gratuite, essai de 60 jours, limites de débit) : voir la compétence `routeros-qemu-chr`
- Pour les bases CLI/REST de RouterOS : voir la compétence `routeros-fundamentals`
- Pour l'arborescence de commandes `/console/inspect` : voir la compétence `routeros-command-tree`

**Outils MCP :**

- Pour la recherche dans la documentation RouterOS : utilisez les outils du serveur MCP `rosetta` (`routeros_search`, `routeros_get_page`)
