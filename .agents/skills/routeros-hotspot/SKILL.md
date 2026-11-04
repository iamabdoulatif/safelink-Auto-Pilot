---
name: routeros-hotspot
description: "Portail captif hotspot de RouterOS pour le contrôle d'accès filaire/sans fil. À utiliser lorsque : vous configurez le hotspot sur RouterOS, mettez en place un portail captif, écrivez des profils ou instances hotspot, configurez le walled garden, définissez l'option DHCP 114 (URI de portail captif RFC 8910), intégrez RADIUS au hotspot, ou lorsque l'utilisateur mentionne /ip/hotspot, walled-garden, profil hotspot, ou portail captif sur MikroTik."
---

# Hotspot RouterOS

## Fonctionnement des chaînes hotspot

L'interception du trafic hotspot s'exécute **avant** les chaînes firewall input/forward classiques. C'est le fait le plus important à intégrer :

- `/ip/hotspot` se lie à un pont ou à une interface — tout le trafic de cette interface entre d'abord dans la chaîne hotspot
- Les règles firewall bloquant TCP 80/443 depuis l'interface hotspot ne bloquent **PAS** la page de connexion du portail captif — le hotspot la traite avant que le firewall ne la voie
- RouterOS injecte automatiquement des règles firewall dynamiques (chaînes `hs-unauth`, `hs-auth`) — ne créez, ne supprimez ni ne modifiez manuellement ces règles gérées par le hotspot

**Erreur courante :** ajouter une règle DROP pour le port 443 depuis bridge-hotspot pour « corriger une faille de sécurité » — cela casse silencieusement la page de connexion HTTPS.

## Profil hotspot

```routeros
/ip/hotspot/profile/add \
  name=my-profile \
  hotspot-address=10.20.0.1 \
  login-by=https,mac,http-pap \
  mac-auth-mode=mac-as-username-and-password \
  dns-name=login.example.com \
  ssl-certificate=login.example.com.crt_0 \
  nas-port-type=ethernet \
  use-radius=yes \
  radius-accounting=yes \
  html-directory-override=hotspot-files
```

Propriétés clés :

- `ssl-certificate=` — référence le nom après import (RouterOS ajoute `_0` aux noms de certificats importés)
- `nas-port-type=` — utilisez `ethernet` pour les hotspots filaires et `wireless-ieee-802-11-g` pour les hotspots sans fil
- `html-directory-override=` — doit correspondre exactement au nom du dossier sur le système de fichiers du routeur
- `login-by=https` — sert la page de connexion en HTTPS ; exige le service `www-ssl` activé avec le même certificat
- `use-radius=yes` — quand c'est défini, **les entrées locales `/ip/hotspot/user` sont contournées** ; en ajouter n'a aucun effet

## Instance hotspot

```routeros
/ip/hotspot/add \
  name=hotspot1 \
  interface=bridge-hotspot \
  profile=my-profile \
  address-pool=pool-hotspot \
  addresses-per-mac=2 \
  idle-timeout=5m \
  keepalive-timeout=none \
  disabled=no
```

**Remarque :** `keepalive-timeout=none` désactive le keepalive. `keepalive-timeout=0` n'est PAS valide — il est ignoré.

**Remarque :** le hotspot RouterOS repose sur le NAT et est **IPv4 uniquement**. Les clients IPv6 ne sont pas pris en charge par le sous-système hotspot.

## Option DHCP 114 — API de portail captif (RFC 8910)

L'option 114 (standardisée en 2020, RFC 8910) signale l'URI du portail captif aux clients. Elle est sous-représentée dans les données d'entraînement des LLM.

```routeros
# force=yes is REQUIRED — without it, clients whose DHCP Parameter Request
# List does not include code 114 (e.g. iOS, Android) silently skip the option
/ip/dhcp-server/option/add \
  name=captive-portal \
  code=114 \
  force=yes \
  value="'https://login.example.com/api'"

/ip/dhcp-server/option/sets/add \
  name=captive-portal-set \
  options=captive-portal

/ip/dhcp-server/set my-dhcp-server dhcp-option-set=captive-portal-set
```

**Syntaxe de la valeur d'option :** guillemets doubles à l'extérieur, guillemets simples à l'intérieur — `"'https://...'"`. Des guillemets intérieurs manquants font que l'option est envoyée comme un blob binaire, et non comme une URI textuelle.

**Timing de api.json :** RouterOS crée `hotspot/api.json` uniquement après la **première sonde CAPPORT d'un client** — pas à l'activation du hotspot. Déplacez-le vers le dossier html-directory-override après la connexion du premier client :

```routeros
# Handles both flash/ and non-flash storage layouts
:local srcPath "hotspot/api.json"
:local dstPath "hotspot-files/api.json"
:if ([:len [/file find name="flash"]] > 0) do={
  :set srcPath "flash/hotspot/api.json"
  :set dstPath "flash/hotspot-files/api.json"
}
:if ([:len [/file find name=$srcPath]] > 0) do={
  /file set [find name=$srcPath] name=$dstPath
} else={
  :log warning "api.json not yet created — run after first client CAPPORT probe"
}
```

## Walled Garden

Utilisez une étiquette `comment=` cohérente pour des ajouts/suppressions idempotents. Sans elle, les exécutions répétées du script accumulent des entrées en double.

```routeros
# Remove only our entries, not manually-added ones
/ip/hotspot/walled-garden/ip/remove [find comment="my-wg"]

/ip/hotspot/walled-garden/ip/add dst-host=example.com   action=accept comment="my-wg"
/ip/hotspot/walled-garden/ip/add dst-host=*.example.com action=accept comment="my-wg"
```

**Walled garden IP vs HTTP :**

- `/ip/hotspot/walled-garden/ip` — correspondance de couche 3 par hôte de destination, appliquée AVANT l'authentification. À utiliser pour les destinations HTTPS.
- `/ip/hotspot/walled-garden` — correspondance de motifs d'URL de couche 7, exige HTTP. Ne fonctionne PAS pour HTTPS.

## Remarque sur le certificat SSL

Le profil hotspot référence `ssl-certificate=name.crt_0` (RouterOS ajoute `_0` à l'import). Activez `www-ssl` avec le même certificat :

```routeros
/ip/service/set www-ssl disabled=no certificate=login.example.com.crt_0 tls-version=only-1.2
```

Modèle d'import rapide :

```routeros
/certificate import file-name=login.example.com.crt passphrase=""
/certificate import file-name=login.example.com.key passphrase=""
# After import, the certificate appears as login.example.com.crt_0
```

## Portail captif externe — variables de modèle HTML

RouterOS substitue `$(variable)` côté serveur dans tout fichier sous `html-directory-override` avant de le servir. Ce ne sont **pas** des variables JavaScript — elles sont remplies avant que le navigateur ne reçoive la page.

La plupart des configurations de portail captif externe surchargent `login.html`, `alogin.html` et `status.html`. Gardez la liste complète des pages servlet, les champs POST, les variables de passage RADIUS, les mécanismes multilingues `target=` et la syntaxe de contrôle des réponses HTTP dans [references/template-variables.md](./references/template-variables.md).

Utilisez `$(link-login-only)` comme point de terminaison POST de connexion, transmettez la destination d'origine via `dst`, et choisissez toujours les variantes échappées telles que `$(link-orig-esc)`, `$(mac-esc)` et `$(username-esc)` pour intégrer des valeurs dans des URL ou des chaînes de requête. Les variantes non échappées peuvent casser l'analyse ou ouvrir des voies d'injection si une valeur contient `&`, `=`, `?` ou `#`.

**Syntaxe conditionnelle** (côté serveur, pas JavaScript) :

```text
$(if logged-in == "yes")
  <a href="$(link-logout)">Logout</a>
$(else)
  <form action="$(link-login-only)" method="post">...</form>
$(endif)
```

Opérateurs : présence (`$(if VAR)`), `==`, `!=`. Aussi `$(elif ...)`. Pas d'arithmétique imbriquée / d'opérations sur les chaînes.

Modèle générique de `login.html` pour un portail captif externe :

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="pragma" content="no-cache">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- External auth provider loads redirect logic -->
  <script src='https://auth.example.com/snippets/router-os/redirect'></script>
</head>
<body>
  <div id="entryPoint">Redirecting...</div>
  <script>
    window.addEventListener('load', function () {
      ExternalAuth_redirect(
        '$(server-name)', '$(mac-esc)', '$(link-login-only)',
        '$(link-orig-esc)', '$(error-orig)', '$(logged-in)', '$(ip)'
      );
    });
  </script>
</body>
</html>
```

Le fournisseur externe authentifie l'utilisateur et redirige le navigateur vers `$(link-login-only)` avec les champs POST `username` + `password` + `dst`. RouterOS valide (base locale ou RADIUS), émet le cookie d'authentification et redirige vers `dst`.

**Le walled-garden doit inclure l'hôte d'authentification externe (et tout hôte CDN/ressources)** — sinon le navigateur non authentifié ne peut pas atteindre le script de redirection de l'étape 2.

## Erreurs courantes des LLM

| Erreur | Comportement correct |
|---------|-----------------|
| DROP TCP 443 depuis l'interface hotspot | La chaîne hotspot s'exécute avant le firewall — casse la page de connexion HTTPS |
| `keepalive-timeout=0` pour désactiver le keepalive | Utilisez `keepalive-timeout=none` |
| Option 114 `value=` sans guillemets simples intérieurs | Doit être `"'https://...'"` — doubles à l'extérieur, simples à l'intérieur |
| Option 114 sans `force=yes` | iOS/Android ignorent silencieusement l'option si elle n'est pas dans leur PRL DHCP |
| Ajout de `/ip/hotspot/user` quand `use-radius=yes` | Les utilisateurs locaux sont contournés quand RADIUS est actif |
| Domaines HTTPS avec joker dans `/ip/hotspot/walled-garden` | Utilisez `/ip/hotspot/walled-garden/ip` pour HTTPS (correspondance couche 3) |
| Hotspot sur réseau double pile avec IPv6 | Le hotspot est IPv4 uniquement — IPv6 non pris en charge |
| `$(link-login)` traité comme une variable JavaScript | C'est une substitution côté serveur RouterOS, pas du JS |
| Intégration de `$(link-orig)` / `$(mac)` / `$(username)` dans une autre URL | Utilisez la variante `-esc` — sans esc, l'analyse casse sur `&`, `=`, `?` et peut permettre une injection |
| Hotspot avec PCC / tables de routage multiples | Le hotspot utilise uniquement la table de routage par défaut — les configurations multi-WAN exigent une `/ip route rule` explicite pour le trafic hotspot |

## Ressources supplémentaires

**Compétences associées :**

- `routeros-fundamentals` — syntaxe CLI RouterOS, API REST, bases du script
- `routeros-certificates` (en attente) — pour le modèle complet de gestion de la chaîne de certificats

**Outils MCP :**

- Serveur MCP `rosetta` — arborescence de commandes `/tool/ping`, `/ip/hotspot` (`routeros_search`, `routeros_get_page`)

**Docs MikroTik :**

- [HotSpot](https://help.mikrotik.com/docs/display/ROS/HotSpot) — référence officielle
- [DHCP Server](https://help.mikrotik.com/docs/display/ROS/DHCP) — configuration de l'option 114

## Intégration RADIUS

Voir [references/radius-client.md](./references/radius-client.md) pour les modèles de configuration du client RADIUS.
