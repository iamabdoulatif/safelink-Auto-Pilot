#!/bin/sh
# Relance tous les serveurs safelink-Auto-Pilot.
# Usage : ./scripts/relance-serveurs.sh
set -eu
cd "$(dirname "$0")/.."

echo "--- Docker : n8n, gotenberg, autopilot-db ---"
docker start n8n gotenberg autopilot-db 2>/dev/null || true
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "n8n|gotenberg|autopilot-db" || true

echo "--- VM CHR safelink (quickchr) ---"
# NOTE (2026-11-02, hote M4/macOS 26 + QEMU 11.1.3) : --accel hvf fait
# paniquer le noyau CHR 7.25 au boot ("No working init found", reboot en
# boucle). TCG demarre (~10 min jusqu'a REST pret). Ne pas repasser en
# hvf sans reverifier le boot (console serie).
bunx @tikoci/quickchr@0.5.2 start safelink --accel tcg --no-wait

echo "--- Redirections runtime (volatiles, a re-ajouter apres chaque start) ---"
# hostfwd_add via le moniteur QEMU : Mikhmon (guest 8088 -> dst-nat container)
# et WebFig/REST (guest 85, www deplace par safelinkhub-api) exposes sur l'hote.
python3 -c "
import os, socket, time
sock='/Users/bambaabdoulatif/.local/share/quickchr/machines/safelink/monitor.sock'
for i in range(30):
    if os.path.exists(sock): break
    time.sleep(2)
else: raise SystemExit('monitor.sock introuvable, VM non demarree ?')
s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM); s.settimeout(8)
s.connect(sock)
s.recv(4096)
for cmd in (b'hostfwd_add tcp::8088-:8088', b'hostfwd_add tcp::9185-:85'):
    s.sendall(cmd+b'\n'); time.sleep(1); s.recv(4096)
print('forwards 8088 (Mikhmon) + 9185 (WebFig/REST) ajoutes')
"

echo "--- Attente REST (peut prendre ~10 min en TCG) ---"
bunx @tikoci/centrs@0.1.8 retrieve --quickchr safelink /system/resource --wait 15m
