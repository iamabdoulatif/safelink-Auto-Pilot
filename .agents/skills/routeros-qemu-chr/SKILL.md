---
name: routeros-qemu-chr
description: 'MikroTik RouterOS CHR (Cloud Hosted Router) avec QEMU. Utiliser quand : exécuter RouterOS sous QEMU, démarrer des images CHR, déboguer des échecs de boot CHR, configurer des périphériques VirtIO pour RouterOS, choisir entre boot SeaBIOS et UEFI, configurer la redirection de ports QEMU pour l’API REST de RouterOS, monter du réseau socket inter-VM ou de la capture L2 côté hôte des broadcasts invités (ex. MNDP), ou choisir l’accélération QEMU (KVM/HVF/TCG).'
---

# RouterOS CHR avec QEMU

## C'est quoi CHR

CHR (Cloud Hosted Router) est l'image RouterOS x86_64 et aarch64 de MikroTik pour les machines virtuelles. La licence gratuite permet un usage illimité avec une limite de 1 Mbps — suffisante pour le développement, les tests, le travail sur l'API et le débogage par capture de paquets. Un essai gratuit de 60 jours lève la limite de débit (avec un compte mikrotik.com gratuit). Voir [Licence CHR](./references/chr-licensing.md) pour tous les détails sur les niveaux de licence, l'activation de l'essai et son expiration.

## Variantes d'images

| Image | Architecture | Méthode de boot | Source |
|---|---|---|---|
| `chr-<ver>.img` | x86_64 | SeaBIOS (chaînage MBR) | download.mikrotik.com |
| `chr-<ver>-arm64.img` | aarch64 | UEFI (pflash EDK2) | download.mikrotik.com |
| `chr-efi.img` (fat-chr) | x86_64 | UEFI (OVMF) | tikoci/fat-chr sur GitHub |

**L'image x86 standard a une partition de boot propriétaire** — elle ressemble à une partition système EFI en GPT mais ce n'EST PAS du FAT. Le firmware UEFI (OVMF) ne peut pas la lire. Seul SeaBIOS sait la démarrer via chaînage MBR.

L'image reconditionnée `fat-chr` convertit cela en FAT16 standard avec `EFI/BOOT/BOOTX64.EFI`, ce qui permet le boot UEFI. Requis pour Apple Virtualization.framework sur macOS x86, optionnel partout ailleurs.

**Disposition du disque** (128 Mio, les deux architectures) : hybride GPT+MBR, partition 1 = boot (~33 Mio), partition 2 = racine ext4 (~94 Mio).

## Télécharger les images CHR

```typescript
// Resolve current version
const channel = "stable"; // or: long-term, testing, development
const version = await fetch(
  `https://upgrade.mikrotik.com/routeros/NEWESTa7.${channel}`
).then(r => r.text()).then(s => s.trim());

// Download x86_64 image
const url = `https://download.mikrotik.com/routeros/${version}/chr-${version}.img.zip`;
// Download aarch64 image
const armUrl = `https://download.mikrotik.com/routeros/${version}/chr-${version}-arm64.img.zip`;
```

Les images sont distribuées en `.img.zip` — dézippez pour obtenir le disque `.img` brut.

## Choix de patrons : invocation QEMU

Il existe plusieurs approches valables pour lancer CHR sous QEMU. Chacune a ses compromis :

### Patron A : arguments en ligne (le plus simple, bien pour les scripts)

Tout sur la ligne de commande. Facile à construire et à déboguer pour un LLM — tout l'état est visible en un seul endroit.

```sh
qemu-system-x86_64 -M q35 -m 256 -smp 1 \
  -drive file=chr.img,format=raw,if=virtio \
  -netdev user,id=net0,hostfwd=tcp::9180-:80 \
  -device virtio-net-pci,netdev=net0 \
  -display none -serial stdio
```

**Avantages :** une seule commande, facile à lire, facile à modifier.
**Inconvénients :** lignes de commande longues, difficiles à versionner, pas de persistance.

### Patron B : script wrapper (bien pour la réutilisation)

Un script shell qui détecte l'accélération, gère les chemins de firmware, gère les fichiers PID.

```sh
#!/bin/sh
# detect acceleration
if [ "$(uname -s)" = "Linux" ] && [ -w /dev/kvm ]; then
  ACCEL="-accel kvm"
elif [ "$(uname -s)" = "Darwin" ] && [ "$(sysctl -n kern.hv_support 2>/dev/null)" = "1" ]; then
  ACCEL="-accel hvf"
else
  ACCEL="-accel tcg"
fi

qemu-system-x86_64 -M q35 -m 256 -smp 1 \
  $ACCEL \
  -drive file=chr.img,format=raw,if=virtio \
  -netdev user,id=net0,hostfwd=tcp::${PORT:-9180}-:80 \
  -device virtio-net-pci,netdev=net0 \
  -display none -serial stdio
```

**Avantages :** portable, gère les différences de plateformes, paramétrable.
**Inconvénients :** limitations du scripting shell, plus dur à composer depuis TypeScript.

### Patron C : lancement programmatique depuis Bun/TypeScript (bien pour les tests d'intégration)

Lancer QEMU comme processus fils avec un contrôle total :

```typescript
import { $ } from "bun";

const port = 9180;
const accel = await detectAccel();
const proc = Bun.spawn([
  "qemu-system-x86_64", "-M", "q35", "-m", "256",
  "-accel", accel,
  "-drive", `file=chr.img,format=raw,if=virtio`,
  "-netdev", `user,id=net0,hostfwd=tcp::${port}-:80`,
  "-device", "virtio-net-pci,netdev=net0",
  "-display", "none",
  "-chardev", `socket,id=serial0,path=/tmp/chr-serial.sock,server=on,wait=off`,
  "-serial", "chardev:serial0",
  "-monitor", `unix:/tmp/chr-monitor.sock,server,nowait`,
], { stdio: ["ignore", "pipe", "pipe"] });

// Wait for boot
await waitForBoot(`http://127.0.0.1:${port}/`);
```

**Avantages :** contrôle total du cycle de vie, gestion d'instances parallèles, natif TypeScript.
**Inconvénients :** plus de code, les args QEMU doivent quand même être corrects.

### Patron D : fichier de config (`--readconfig`) (déclaratif, utilisé par mikropkl)

`--readconfig` de QEMU charge un fichier au format INI pour la config machine/périphériques. Le projet mikropkl l'utilise pour son packaging déclaratif de VM.

**Compromis :** sépare les préoccupations (config vs lancement), mais le format INI est obscur et toutes les options QEMU ne peuvent pas s'y exprimer (pflash, `-accel`, `-netdev user,hostfwd` exigent tous la ligne de commande). Mieux adapté aux projets qui génèrent les configs programmatiquement.

## Pistes de boot

### x86_64 avec SeaBIOS (défaut, le plus rapide)

Aucune configuration de firmware nécessaire — le SeaBIOS intégré de QEMU gère le secteur de boot propriétaire de MikroTik :

```sh
qemu-system-x86_64 -M q35 -m 256 \
  -drive file=chr-7.22.img,format=raw,if=virtio \
  -netdev user,id=net0,hostfwd=tcp::9180-:80 \
  -device virtio-net-pci,netdev=net0 \
  -display none -serial stdio
```

`-M pc` (i440fx, PCI legacy) marche aussi pour CHR. CHR n'exploite quasiment rien de ce que q35 apporte (topologie PCIe moderne, hotplug ACPI, etc.) car le noyau RouterOS contourne la pile BIOS/ACPI après le boot — ce sont les périphériques PCI VirtIO qu'il utilise vraiment, et les deux types de machine les exposent pareillement. Pour la preuve côté config noyau, voir [tikoci/mikrotik-gpl](https://github.com/tikoci/mikrotik-gpl) (archive de config noyau v7.2).

Temps de boot : ~5 s (KVM), ~30 s (TCG). Pour TCG, `-accel tcg,tb-size=256` agrandit le cache de traduction et réduit sensiblement le temps de boot sur les runs répétés.

### aarch64 avec UEFI (EDK2)

Exige les fichiers firmware pflash UEFI. **Les deux unités pflash doivent avoir exactement la même taille** (typiquement 64 Mio) :

```sh
# Copy vars file (writable) — never modify the original
cp /path/to/edk2-arm-vars.fd /tmp/my-vars.fd

qemu-system-aarch64 -M virt -cpu cortex-a710 -m 256 \
  -drive if=pflash,format=raw,readonly=on,unit=0,file=/path/to/edk2-aarch64-code.fd \
  -drive if=pflash,format=raw,unit=1,file=/tmp/my-vars.fd \
  -drive file=chr-arm64.img,format=raw,if=none,id=drive0 \
  -device virtio-blk-pci,drive=drive0 \
  -netdev user,id=net0,hostfwd=tcp::9180-:80 \
  -device virtio-net-pci,netdev=net0 \
  -display none -serial stdio
```

Temps de boot : ~10 s (KVM), ~20 s (TCG natif), ~20 s (TCG cross-arch sur hôte x86).

### Emplacements des firmwares UEFI

| Plateforme | ROM de code | Fichier vars |
|---|---|---|
| macOS Homebrew (Apple Silicon) | `/opt/homebrew/share/qemu/edk2-aarch64-code.fd` | `edk2-arm-vars.fd` |
| macOS Homebrew (Intel) | `/usr/local/share/qemu/edk2-aarch64-code.fd` | `edk2-arm-vars.fd` |
| Ubuntu/Debian | `/usr/share/AAVMF/AAVMF_CODE.fd` | `AAVMF_VARS.fd` |
| OVMF x86 (Homebrew) | `edk2-x86_64-code.fd` | `edk2-i386-vars.fd` |
| OVMF x86 (Linux) | `/usr/share/OVMF/OVMF_CODE.fd` | `OVMF_VARS.fd` |

## VirtIO — détails critiques

Voir la [matrice des pilotes VirtIO](./references/virtio-drivers.md) pour le tableau complet.

**La règle unique :** RouterOS a `virtio_pci` mais PAS `virtio_mmio`. C'est crucial sur aarch64.

### Le piège du `if=virtio` (aarch64)

```text
                         x86_64 (q35)              aarch64 (virt)
if=virtio shorthand →    virtio-blk-pci (PCI) ✅    virtio-blk-device (MMIO) ❌
-device virtio-blk-pci → virtio-blk-pci (PCI) ✅    virtio-blk-pci (PCI) ✅
```

Sur x86_64 `q35`, `if=virtio` se résout en PCI — ça marche. Sur aarch64 `virt`, ça se résout en MMIO — **le noyau RouterOS se bloque silencieusement**. Utilisez toujours `-device virtio-blk-pci` explicite sur aarch64 :

```sh
# WRONG on aarch64 — silent boot failure
-drive file=chr.img,format=raw,if=virtio

# CORRECT on aarch64 — explicit PCI device
-drive file=chr.img,format=raw,if=none,id=drive0
-device virtio-blk-pci,drive=drive0
```

Sur x86_64, les deux marchent. La forme explicite est toujours sûre sur les deux architectures.

### Réseau — universel

Toutes architectures : `virtio-net-pci`. Sans exceptions :

```sh
-netdev user,id=net0,hostfwd=tcp::9180-:80
-device virtio-net-pci,netdev=net0
```

`user` (SLIRP) est un NAT en espace utilisateur — idéal pour l'administration (redirections de REST/SSH/WinBox),
mais il **termine la couche 2** : les broadcasts et l'UDP non redirigé n'atteignent jamais l'hôte ni les
autres VM. Pour tout ce qui est L2 (liens inter-VM, découverte de voisins, MAC-Telnet), ajoutez une seconde
NIC sur un netdev `socket`.

### Réseau L2 : netdevs `socket` (liens inter-VM + capture hôte)

Le netdev `socket` de QEMU transporte des trames Ethernet brutes sur un socket hôte — sans privilèges, sans
configuration supplémentaire :

```sh
# TCP, point-to-point — one side listens, the other connects
-netdev socket,id=net1,listen=:4001            # VM A (start first)
-netdev socket,id=net1,connect=127.0.0.1:4001  # VM B
# UDP multicast — shared L2 segment for N VMs
-netdev socket,id=net1,mcast=230.0.0.1:4001
```

> **⚠ `mcast` est cassé sur macOS.** Le socket multicast de QEMU ne pose que
> `SO_REUSEADDR`, mais macOS/BSD exigent `SO_REUSEPORT` sur chaque socket partageant un port multicast — donc sur macOS
> rien n'est délivré entre sockets locaux : deux VM sur le même groupe ne se découvrent pas
> l'une l'autre, et un listener hôte ne reçoit aucune trame. Ça marche sur **Linux** (et en CI).
> Pour du point à point sur macOS utilisez TCP `listen`/`connect` ; il n'y a **aucun segment L2
> multi-VM sans privilèges sur macOS** aujourd'hui (utilisez `socket_vmnet`, à privilèges uniques, pour ça).

#### Capture hôte des trames L2 invitées (ex. MNDP)

Pour laisser un processus **hôte** recevoir les broadcasts d'un invité — la découverte de voisins MNDP (le protocole
derrière l'onglet « Neighbors » de WinBox, UDP/5678) étant le premier cas — faites de l'hôte une
extrémité d'un netdev `socket` TCP :

1. L'hôte fait tourner un serveur TCP sur un port loopback.
2. CHR reçoit une seconde NIC : `-netdev socket,id=net1,connect=127.0.0.1:<port>` — l'hôte doit
   écouter **avant** le démarrage de QEMU, puisque QEMU est le côté qui se connecte.
3. QEMU streame chaque trame invitée vers l'hôte, **préfixée par sa longueur** : un entier de 4 octets big-endian,
   puis la trame Ethernet brute.
4. L'hôte retire le préfixe et parse Ethernet → IPv4 → UDP/5678 → TLV MNDP.

Écrire une trame préfixée par sa longueur sur la même connexion **injecte** du L2 dans l'invité
(ex. un refresh MNDP pour déclencher une réponse immédiate — la même primitive dont MAC-Telnet a besoin).
Loopback uniquement, donc rien ne fuit sur le LAN ; marche sur macOS, Linux et Windows pareil.

Implémentation de référence + preuve vérifiée : `tikoci/quickchr` (`examples/mndp/`,
`docs/mndp.md`, `test/lab/mndp/REPORT.md`). Pour le format du wire MNDP et la table des TLV, voir la
compétence `routeros-mndp`.

## Détection de l'accélération

```typescript
import { $ } from "bun";

async function detectAccel(guestArch: string): Promise<string> {
  const hostOs = process.platform;  // "darwin" | "linux"
  const hostArch = process.arch;    // "x64" | "arm64"

  if (hostOs === "linux") {
    // KVM requires host/guest architecture match
    const kvm = await Bun.file("/dev/kvm").exists();
    const archMatch = (guestArch === "x86_64" && hostArch === "x64")
      || (guestArch === "aarch64" && hostArch === "arm64");
    if (kvm && archMatch) return "kvm";
  }

  if (hostOs === "darwin") {
    // HVF may not be available (e.g., GitHub Actions VMs)
    const hvOk = await $`sysctl -n kern.hv_support`.text().then(s => s.trim() === "1").catch(() => false);
    const archMatch = (guestArch === "aarch64" && hostArch === "arm64")
      || (guestArch === "x86_64" && hostArch === "x64");
    if (hvOk && archMatch) return "hvf";
  }

  return "tcg";  // Software emulation — always available
}
```

**Règle clé :** KVM et HVF exigent tous deux la correspondance d'architecture hôte/invité. Le cross-arch retombe toujours sur TCG. Ne testez pas seulement `/dev/kvm` — vérifiez aussi que les architectures correspondent.

### Piège du modèle CPU avec HVF (macOS)

Avec `-accel hvf`, QEMU expose le CPU hôte directement. Spécifier un modèle de CPU comme `cortex-a710` (ARMv9, exige SVE2) sur Apple Silicon (ARMv8.5) fait crasher QEMU avant le démarrage de la VM. Utilisez `-cpu host` avec HVF :

```sh
# TCG/KVM — specify exact model
CPU_FLAGS="-cpu cortex-a710"

# HVF — passthrough host CPU
if [ "$ACCEL" = "hvf" ]; then
  CPU_FLAGS="-cpu host"
fi
```

## Contrôle de santé et attente du boot

WebFig de RouterOS répond avec HTTP 200 sur le port 80 sans authentification — ça marche comme contrôle de santé minimal :

```typescript
async function waitForBoot(url: string, timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch { /* not ready yet */ }
    await Bun.sleep(2000);
  }
  return false;
}
```

### Course au démarrage — piège si vous appelez l'API REST juste après

Le boot de RouterOS est étagé du point de vue du client :

1. Connexion refusée — QEMU démarre encore
2. `ECONNRESET` — serveur HTTP levé mais sous-système REST pas encore prêt
3. 401 de `/rest/*` — middleware d'auth levé ; le handler REST peut encore s'initialiser
4. 200 mais **corps faux** — REST initialisé avant que les tables de routage se stabilisent ; `/system/resource` peut brièvement retourner un tableau (ex. une liste `/user`) avant de retourner l'objet singleton attendu
5. 200 avec le bon corps — pleinement opérationnel

Un contrôle de santé sur la racine `/` atteint l'étape 2 mais ne donne aucun signal sur 3–5. Pour du code qui appellera l'API REST immédiatement après, sondez `/rest/system/resource` avec auth et exigez **deux sondes réussies consécutives** avec la forme de corps attendue (objet singleton contenant `board-name`). Sur les contrôles d'auth seule (admin non provisionné), acceptez 401/403 comme « couche REST répond ». Le check `/` + HTTP 200 convient pour « est-ce levé ? » mais pas pour « puis-je commencer à appeler REST maintenant ? ».

## Redirection de ports

Réseau utilisateur QEMU (`-netdev user,hostfwd=...`) pour les services RouterOS typiques :

| Service | Port invité | Exemple de port hôte | hostfwd |
|---|---|---|---|
| WebFig/API REST | 80 | 9180 | `tcp::9180-:80` |
| SSH (CLI RouterOS) | 22 | 9122 | `tcp::9122-:22` |
| Protocole API | 8728 | 9728 | `tcp::9728-:8728` |
| API-SSL | 8729 | 9729 | `tcp::9729-:8729` |
| WinBox | 8291 | 9291 | `tcp::9291-:8291` |

Plusieurs redirections dans un seul netdev :

```sh
-netdev user,id=net0,hostfwd=tcp::9180-:80,hostfwd=tcp::9122-:22,hostfwd=tcp::9728-:8728
```

Utilisez des ports hôtes uniques par instance quand vous faites tourner plusieurs CHR (9180, 9181, 9182...).

## Limitations connues

- **QGA (Guest Agent) exige KVM** — le démon QGA du CHR RouterOS ne démarre que quand il
  détecte un hyperviseur KVM via CPUID. Sous HVF (macOS) ou TCG (émulation logicielle),
  CPUID 0x40000000 ne retourne aucune chaîne vendeur KVM et 0x40000001 aucun
  feature KVM, donc le démon ne démarre jamais. QEMU fournit correctement le port série virtio et envoie
  PORT_OPEN (événement 6) — l'invité ne l'ouvre simplement jamais (`query-chardev` montre
  `frontend-open=false`). Ce n'EST PAS un bug QEMU. MikroTik documente QGA exclusivement
  sous la section « KVM ». Les tests QGA exigent Linux + KVM (labo mikropkl).
- **`check-installation` échoue sur aarch64** dans tous les environnements QEMU — c'est un problème firmware/DTB non résoluble (voir [problèmes connus](./references/known-issues.md))
- **Le boot direct `-kernel` ne marche pas** pour aucune des deux architectures — RouterOS exige tout son chemin de boot firmware
- **TCG cross-arch : x86_64 sur hôte aarch64 n'est pas viable** — l'émulation des ports E/S x86 est trop lente (~300 s+ de timeouts). Le sens inverse (aarch64 sur x86_64) marche bien (~20 s)
- **Pas de pilote `virtio_mmio`** — utilisez toujours `-device virtio-blk-pci` explicite, jamais `if=virtio` sur aarch64
- **`socket,mcast=` inter-réseau est cassé sur macOS** — QEMU ne pose que
  `SO_REUSEADDR` ; macOS/BSD exigent `SO_REUSEPORT` pour partager un port multicast, donc aucune trame
  n'est délivrée entre sockets locaux (les VM ne se découvrent pas, la capture hôte ne reçoit rien).
  Utilisez le `socket` TCP (listen/connect) pour du point à point, ou `socket_vmnet` pour un segment
  partagé. Marche sur Linux/CI. Vérifié dans `tikoci/quickchr` (`test/lab/mndp/REPORT.md`)

## Ressources supplémentaires

- [Matrice des pilotes VirtIO](./references/virtio-drivers.md) — tableau complet du support des pilotes
- [Problèmes connus](./references/known-issues.md) — échecs de boot, limitations cross-arch
- [Patrons CI GitHub Actions](./references/github-actions-ci.md) — faire tourner CHR sur des runners hébergés GitHub
- [Licence CHR](./references/chr-licensing.md) — offre gratuite (1 Mbps), essai 60 jours, offres payantes, expiration
- Pour l'implémentation de référence **quickchr** — piloter CHR depuis des tests et
  l'automatisation (`QuickCHR.start`, `exec`/`rest`, recettes réseau, la surface de connexion pour les harnais) :
  voir la compétence `routeros-quickchr`
- Pour la CLI/REST RouterOS une fois booté : voir la compétence `routeros-fundamentals`
- Pour la capture de paquets et le streaming TZSP depuis CHR : voir la compétence `routeros-sniffer`
- Pour le format du wire MNDP / TLVs (reçus via la recette de capture hôte ci-dessus) : voir la compétence `routeros-mndp`
- Pour le format de conteneur YAML /app (exige le paquet container CHR) : voir la compétence `routeros-app-yaml`
