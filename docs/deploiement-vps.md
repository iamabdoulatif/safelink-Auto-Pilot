# Déploiement VPS (Hostinger) — SafeLink-Auto-Pilot

Préparation uniquement : rien ici ne déploie ni ne démarre quoi que ce soit.
Principe : l'interface d'administration RouterOS (WebFig, Winbox, API) ne
s'expose JAMAIS sur Internet. Le VPS parle au routeur par VPN/tunnel ou IP
dédiée filtrée, jamais en direct public.

## 1. Adresses locales interdites en production

| Où (dev) | Valeur dev | Valeur prod |
|---|---|---|
| `N8N_BASE_URL`, `N8N_WEBHOOK_URL` | `http://localhost:5678` | `https://n8n.ton-domaine.tld` (+ `/` final pour les webhooks) |
| `APP_URL` | `http://localhost:3000` ou `host.docker.internal:3000` | `https://app.ton-domaine.tld` |
| `MIKHMON_BASE_URL` | `http://host.docker.internal:8088` | URL Mikhmon vue DEPUIS le VPS (option A/B/C §5) |
| `ROUTEROS_BASE_URL` | `https://192.168.88.1` | URL RouterOS vue DEPUIS le VPS (VPN/tunnel, §5) |
| `DATABASE_URL` | `localhost:5432` | `postgres:5432` (service interne du compose, jamais exposé) |
| Formulaire Mikhmon (page connexions) | `127.0.0.1:8088` par défaut | IP/nom joignable depuis le navigateur + dérivation auto n8n |
| `N8N_HOST` | `localhost` | `n8n.ton-domaine.tld` |
| `N8N_PROXY_HOPS` | `0` (direct) | `1` (derrière Caddy) |
| `WEBHOOK_URL` | `http://localhost:5678/` | rempli auto depuis `N8N_WEBHOOK_URL` par le compose |

## 2. Valeurs à préparer (une seule fois, hors VPS pour les secrets)

| Variable | Exemple prod | Où |
|---|---|---|
| `APP_URL` | `https://app.ton-domaine.tld` | `web/.env.local` (prod) |
| `N8N_BASE_URL`, `N8N_WEBHOOK_URL` | `https://n8n.ton-domaine.tld` | `web/.env.local` + `n8n/.env` |
| `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` | `openssl rand -hex 32` | les deux, IDENTIQUES des deux côtés |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32` | `n8n/.env` + **copie hors VPS** (perdue = credentials à refaire) |
| `N8N_BASIC_AUTH_PASSWORD` | mot de passe long | `n8n/.env` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` | `n8n/.env` (+ `DATABASE_URL` côté app) |
| `ROUTEROS_BASE_URL` | `https://10.8.0.2` (VPN, exemple) | `n8n/.env` + config routeur SafeLink |
| `ROUTEROS_USER` / `ROUTEROS_PASS` | compte `n8n-vouchers` dédié | `n8n/.env` (repli ; l'app envoie les siens par appel signé) |
| `MIKHMON_BASE_URL` | `http://10.8.0.3:8088` (exemple) | `n8n/.env` + config Mikhmon SafeLink |
| `TELEGRAM_BOT_TOKEN` | jeton BotFather | `web/.env.local` + `n8n/.env` |
| `SESSION_SECRET`, `CRON_SECRET`, `CHIFFREMENT_CLE` | `openssl rand -hex 32` | `web/.env.local` (ne changent pas de sens en prod) |

## 3. Fichiers prod (exemples, à copier sur le VPS)

- [n8n/docker-compose.prod.yml](../n8n/docker-compose.prod.yml) — n8n `1.123.92` épinglé, PostgreSQL 17, Gotenberg, Caddy. Seuls 80/443 publiés ; ni Postgres ni n8n direct. Volumes persistants (`n8n_data`, `pgdata`).
- [n8n/.env.prod.example](../n8n/.env.prod.example) — modèle à copier en `n8n/.env`. Secrets vides : le compose **refuse** de démarrer sans eux (`${VAR:?message}`).
- [n8n/Caddyfile.example](../n8n/Caddyfile.example) — HTTPS auto pour `n8n.*` et `app.*` (Next tourne à part : `npm run start`, port 3000).

## 4. Pourquoi `127.0.0.1` ne marche pas depuis le VPS

`127.0.0.1` = « cette machine-ci ». Sur ton PC, ça désigne ton PC (où
tourne Mikhmon). Sur le VPS, ça désigne le VPS (où Mikhmon ne tourne
pas). Chaque hôte a SA boucle locale : l'adresse n'est pas transportable.
Idem pour `host.docker.internal` (astuce Docker Desktop uniquement).

## 5. Options réseau (choisir UNE)

- **A (recommandé) — Mikhmon sur le VPS :** installe le PHP Mikhmon à côté
  de la pile (`MIKHMON_BASE_URL=http://mikhmon:8088`, service interne).
  Trafic local au VPS, rien d'exposé. Le routeur reste joint en VPN.
- **B — VPN Tailscale/WireGuard :** VPS + PC Mikhmon + routeur dans le même
  réseau privé (`10.x`). `MIKHMON_BASE_URL=http://<ip-vpn>:8088`,
  `ROUTEROS_BASE_URL=https://<ip-vpn-routeur>`. Chiffré, sans port public.
- **C — Tunnel privé :** `autossh` du PC local vers le VPS (remote-forward
  du port Mikhmon). Fragile (reconnexion à surveiller) : dépannage OK,
  production à éviter.

## 6. Pare-feu routeur (à appliquer À LA MAIN, jamais en auto)

```routeros
/ip/firewall/address-list/add list=safelink-vps address=<IP_DU_VPS> comment="safelink-vps"
/ip/firewall/filter/add chain=input connection-state=established,related action=accept comment="safelink-ok"
/ip/firewall/filter/add chain=input src-address-list=safelink-vps protocol=tcp dst-port=<PORT_API_REST> action=accept comment="safelink-api" place-before=0
```

Règles : API REST uniquement depuis l'IP du VPS, Winbox/WebFig jamais
depuis Internet, `place-before=0` avant tout `drop`, préfixe de commentaire
pour retrouver ses règles. Vérifie l'accès après chaque règle.

## 7. Checklist déploiement

1. DNS : `app.*` et `n8n.*` pointent vers le VPS ; ports 80/443 ouverts, le reste fermé.
2. Secrets générés (`openssl rand -hex 32`) + `N8N_ENCRYPTION_KEY` copiée hors VPS.
3. `n8n/.env` rempli depuis `.env.prod.example`, `Caddyfile` renommé et adapté.
4. `docker compose -f n8n/docker-compose.prod.yml --env-file n8n/.env config` OK.
5. `up -d`, migrations app OK, import des 2 workflows, exécution à vide.
6. Tests réseau §8 tous verts, puis seulement : workflows en Active.
7. Sauvegardes : `pg_dump` régulier + volume `n8n_data`.

## 8. Tests réseau AVANT activation (depuis le VPS)

```bash
dig +short app.ton-domaine.tld            # doit rendre l'IP du VPS
curl -sI https://app.ton-domaine.tld | head -1        # 200/307 + cert valide
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5678/login  # n8n local (via ssh) : 200
curl -sk -u LECTURE_SEULE https://<routeur-vpn>/rest/system/identity   # 200, jamais d'admin
curl -s -o /dev/null -w "%{http_code}\n" <MIKHMON_BASE_URL>/admin.php  # page login Mikhmon
curl -s -o /dev/null -w "%{http_code}\n" https://api.telegram.org      # 404 attendu = joignable
curl -s -u <PRINTNODE_KEY>: https://api.printnode.com/whoami           # JSON du compte
```

| Service | Test | Attendu |
|---|---|---|
| SafeLink | `curl -sI https://app.*` | 200/307, certificat valide |
| n8n | `https://n8n.*` + import workflow | login OK, exécution à vide OK |
| Mikhmon | URL §5 | page login, pas d'erreur TLS |
| RouterOS | REST avec compte lecture | 200 sur `/rest/system/identity` |
| Telegram | `api.telegram.org` | joignable (404 sur `/` = normal) |
| PrintNode | `/whoami` | JSON du compte |
| WhatsApp | webhook configuré | 200 sur l'URL du fournisseur |
