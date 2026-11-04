---
name: routeros-command-tree
description: "Introspection de l'arborescence des commandes RouterOS via l'API /console/inspect. À utiliser pour : construire des outils qui analysent les commandes RouterOS, générer des schémas d'API depuis RouterOS, travailler avec /console/inspect, faire correspondre les commandes CLI aux verbes REST, parcourir la hiérarchie des commandes RouterOS, ou lorsque l'utilisateur mentionne inspect, command tree, RAML, ou la génération OpenAPI pour RouterOS."
---

# Arborescence des commandes RouterOS et /console/inspect

## Aperçu

RouterOS organise toute la configuration et les commandes dans une **arborescence hiérarchique**. Chaque chemin de la CLI
(comme `/ip/address/add`) correspond à un nœud de cette arborescence. Le point de terminaison REST `/console/inspect`
permet d'**explorer toute l'arborescence par programme** — c'est ainsi que des outils comme `restraml` (générateur de schéma RAML/OpenAPI)
et `rosetta` (recherche de commandes MCP) construisent leurs bases de données.

## Structure de l'arborescence des commandes

La hiérarchie des commandes RouterOS comporte quatre types de nœuds :

| Type de nœud | Signification | Exemple |
|---|---|---|
| `dir` | Répertoire — contient des chemins enfants | `/ip`, `/system` |
| `path` | Chemin — un niveau navigable (a souvent des commandes) | `/ip/address`, `/interface/bridge` |
| `cmd` | Commande — une action exécutable | `add`, `set`, `print`, `remove`, `get`, `export` |
| `arg` | Argument — un paramètre d'une commande | `address=`, `interface=`, `disabled=` |

### Exemple d'arborescence

```text
/ (root dir)
├── ip/ (dir)
│   ├── address/ (path)
│   │   ├── add (cmd)
│   │   │   ├── address (arg) — "IP address"
│   │   │   ├── interface (arg) — "Interface name"
│   │   │   └── disabled (arg) — "yes | no"
│   │   ├── set (cmd)
│   │   ├── remove (cmd)
│   │   ├── get (cmd)
│   │   ├── print (cmd)
│   │   └── export (cmd)
│   ├── route/ (path)
│   │   └── ...
│   └── dns/ (path)
│       ├── set (cmd)
│       ├── cache/ (path)
│       │   ├── print (cmd)
│       │   └── flush (cmd)
│       └── ...
├── interface/ (dir)
│   └── ...
├── system/ (dir)
│   └── ...
└── ...
```

## API /console/inspect

### Point de terminaison

```text
POST /rest/console/inspect
```

Nécessite une authentification basique. Disponible sur toutes les versions RouterOS 7.x.

### Types de requêtes

| Requête | Objet | Retourne |
|---|---|---|
| `child` | Lister les enfants d'un chemin | Tableau de `{type: "child", name, "node-type"}` |
| `syntax` | Obtenir le texte d'aide d'un nœud | Tableau de `{type: "syntax", text}` |
| `highlight` | Données de coloration syntaxique | Classes de jetons par octet — voir la compétence `routeros-syntax-inspection` |
| `completion` | Suggestions de complétion par tabulation | Candidats de complétion — voir `routeros-syntax-inspection` pour le contrôle de validité |

### Lister les enfants

```typescript
// List children of /ip
const children = await fetch(`${base}/console/inspect`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({
    request: "child",
    path: "ip",
  }),
}).then(r => r.json());

// Response:
// [
//   { "type": "child", "name": "address",    "node-type": "path" },
//   { "type": "child", "name": "arp",        "node-type": "path" },
//   { "type": "child", "name": "cloud",      "node-type": "path" },
//   { "type": "child", "name": "dhcp-client", "node-type": "path" },
//   { "type": "child", "name": "dns",        "node-type": "path" },
//   { "type": "child", "name": "route",      "node-type": "path" },
//   ...
// ]
```

### Obtenir l'aide syntaxique

```typescript
// Get description for /ip/address/add → address argument
const syntax = await fetch(`${base}/console/inspect`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({
    request: "syntax",
    path: "ip,address,add,address",   // comma-separated path
  }),
}).then(r => r.json());

// Response:
// [{ "type": "syntax", "text": "IP address" }]
```

### Format du chemin

Le champ `path` utilise des segments **séparés par des virgules** (pas des barres obliques) :

- Racine : `""` (chaîne vide)
- `/ip` : `"ip"`
- `/ip/address` : `"ip,address"`
- `/ip/address/add` : `"ip,address,add"`
- `/ip/address/add → address arg` : `"ip,address,add,address"`

Avec la méthode JavaScript `Array.toString()`, ce format séparé par des virgules est produit
naturellement depuis un tableau : `["ip", "address", "add"].toString()` → `"ip,address,add"`.

## Motif de parcours de l'arborescence

Pour parcourir toute l'arborescence récursivement :

```typescript
async function walkTree(path = [], tree = {}) {
  const children = await fetchInspect("child", path.toString());

  for (const child of children) {
    if (child.type !== "child") continue;

    const childPath = [...path, child.name];
    tree[child.name] = { _type: child["node-type"] };

    // For args, fetch the syntax description — but NOT inside dangerous subtrees
    if (child["node-type"] === "arg") {
      if (DANGEROUS_PATHS.some(p => childPath.includes(p))) continue;

      const syntax = await fetchInspect("syntax", childPath.toString());
      if (syntax.length === 1 && syntax[0].text.length > 0) {
        tree[child.name].desc = syntax[0].text;
      }
    }

    // Recurse into this child (child enumeration is safe even in dangerous subtrees)
    await walkTree(childPath, tree[child.name]);
  }

  return tree;
}
```

### Chemins dangereux — politique d'exclusion conservatrice

Les anciennes versions de RouterOS peuvent **bloquer le serveur REST** quand des chemins de mots-clés de script sont
interrogés pour syntax/completion via `/console/inspect`. Les robots d'exploration ignorent prudemment les
recherches de syntaxe dans les sous-arborescences contenant l'un de ces noms :

```text
where, do, else, rule, command, on-error
```

Ce sont des constructions de script RouterOS. Traitez la liste des six chemins comme une **politique
d'exclusion conservatrice pour robot, pas comme une règle de plantage intemporelle** : des sondages actifs dans
[tikoci/restraml](https://github.com/tikoci/restraml) (dossier de support MikroTik SUP-127641)
ont isolé le blocage confirmé au `do` nu avec `request=syntax`/`completion` sur
RouterOS ≤7.20.8 — les cinq autres chemins retournent `[]` instantanément là — et l'ont trouvé
**corrigé en 7.21.4**. (Le folklore initial des six chemins venait du sondage séquentiel : une fois que
`do` bloque le serveur, chaque chemin testé après semble aussi planter.) Énumérer les
enfants (requête `child`) est sûr sur toutes les versions testées, tout comme les chemins imbriqués comme
`["do","command"]`.

L'approche conservatrice (utilisée dans l'exemple ci-dessus) ignore l'argument entier quand un
ancêtre correspond à un chemin dangereux, et associe chaque requête à un délai court sur les versions anciennes
ou inconnues. L'implémentation réelle de `rest2raml.js` suit ce modèle.

```typescript
const DANGEROUS_PATHS = ["where", "do", "else", "rule", "command", "on-error"];
```

## Correspondance commande CLI → verbe REST

Les commandes CLI RouterOS correspondent aux verbes HTTP dans l'API REST :

| Commande CLI | Verbe HTTP | Motif d'URL REST | Notes |
|---|---|---|---|
| `get` (liste) | `GET` | `/rest/ip/address` | Retourne un tableau de toutes les entrées |
| `get` (unique) | `GET` | `/rest/ip/address/*1` | Entrée unique par ID |
| `add` | `PUT` | `/rest/ip/address` | **Crée** une nouvelle entrée (pas POST !) |
| `set` | `PATCH` | `/rest/ip/address/*1` | Met à jour une entrée existante |
| `remove` | `DELETE` | `/rest/ip/address/*1` | Supprime une entrée par ID |
| `print` | `POST` | `/rest/ip/address/print` | Style action (fonctionne aussi en GET) |
| Autres commandes | `POST` | `/rest/path/command` | Action — reboot, flush, etc. |

**Point clé :** REST `PUT` = création, `PATCH` = mise à jour. C'est l'**inverse** de nombreuses conventions d'API REST où PUT est une mise à jour idempotente et POST une création.

### Génération de schéma RAML/OpenAPI

Lors de la génération de schémas d'API depuis l'arborescence des commandes :

1. Parcourez l'arborescence pour collecter tous les chemins, commandes et arguments
2. Pour chaque nœud `cmd` :
   - `get` → génère à la fois `GET /path` (liste) et `GET /path/{id}` (unique)
   - `add` → génère `PUT /path` avec corps de requête basé sur les arguments
   - `set` → génère `PATCH /path/{id}` avec corps de requête basé sur les arguments
   - `remove` → génère `DELETE /path/{id}`
   - Autres commandes → `POST /path/command`
3. Pour chaque `arg` sous une commande, générez les propriétés du corps de requête ou les paramètres de requête
4. Le champ `desc` des recherches de syntaxe devient la description

### Les paramètres .proplist et .query

Tous les points de terminaison de commande basés sur POST acceptent deux paramètres spéciaux :

- `.proplist` — sélectionne les propriétés à retourner (comme SQL SELECT)
- `.query` — tableau d'expressions de filtre (comme SQL WHERE)

Ce sont des conventions de l'API REST RouterOS, pas des motifs REST standard.

## Formats de sortie

L'arborescence inspect peut être convertie en plusieurs formats de schéma :

### inspect.json (sortie brute)

L'arborescence brute telle que retournée par les appels récursifs `/console/inspect`. Chaque nœud possède :

```json
{
  "address": {
    "_type": "path",
    "add": {
      "_type": "cmd",
      "address": { "_type": "arg", "desc": "IP address" },
      "interface": { "_type": "arg", "desc": "Interface name" }
    },
    "set": { "_type": "cmd", ... },
    "print": { "_type": "cmd", ... }
  }
}
```

### RAML 1.0 (schema.raml)

Convertie en notation ressource/méthode RAML 1.0 :

```yaml
/ip:
  /address:
    get:
      queryParameters: ...
      responses: ...
    put:
      body:
        application/json:
          properties:
            address: { type: any, description: "IP address" }
    /{id}:
      get: ...
      patch: ...
      delete: ...
```

### OpenAPI 3.0 (openapi.json)

Schéma OpenAPI 3.0 standard généré depuis la même arborescence inspect (7.21.1+).

## Le modèle de données inspect.json

Le `inspect.json` de chaque version est la **source de vérité canonique** de l'arborescence des commandes de cette version RouterOS. Il capture :

- Chaque chemin navigable dans la hiérarchie CLI
- Chaque commande exécutable à chaque niveau de chemin
- Chaque argument (paramètre) de chaque commande
- Les descriptions syntaxiques des arguments

Les outils peuvent analyser `inspect.json` hors ligne sans routeur actif — définissez la variable d'environnement `INSPECTFILE`
et le générateur de schéma utilisera le fichier en cache au lieu d'interroger un routeur.

## Motifs courants pour travailler avec l'arborescence

### Trouver les commandes d'un chemin

```typescript
// Given an inspect.json node for /ip/address
const node = inspectData.ip.address;

// Commands are children with _type === "cmd"
const commands = Object.entries(node)
  .filter(([key, val]) => val._type === "cmd")
  .map(([key]) => key);
// → ["add", "set", "remove", "get", "print", "export", ...]
```

### Trouver les arguments d'une commande

```typescript
// Arguments of /ip/address/add
const addCmd = inspectData.ip.address.add;
const args = Object.entries(addCmd)
  .filter(([key, val]) => val._type === "arg")
  .map(([key, val]) => ({ name: key, description: val.desc }));
// → [{name: "address", description: "IP address"}, ...]
```

### Parcourir les répertoires

```typescript
// Directories and paths (navigable children)
const children = Object.entries(node)
  .filter(([key, val]) => val._type === "dir" || val._type === "path")
  .map(([key]) => key);
```

## Notes de performance

- **Le parcours complet de l'arborescence prend de nombreuses minutes** contre un routeur actif (des milliers de requêtes HTTP,
  chacune un POST séparé vers `/console/inspect`). Avec l'accélération KVM, le CHR répond vite,
  mais le grand nombre de requêtes séquentielles s'accumule.
- Chaque appel `/console/inspect` est une requête HTTP séparée — pas d'API de lot
- Utilisez `INSPECTFILE` pour le développement/test afin d'éviter les requêtes actives répétées
- L'arborescence est spécifique à la version — les différentes versions de RouterOS ont des jeux de commandes différents
- Les paquets supplémentaires (container, iot, zerotier, etc.) ajoutent des branches supplémentaires à l'arborescence des commandes

## Ressources supplémentaires

- Le nouveau site de manuel de MikroTik propose une **référence CLI** navigable sur
  <https://manual.mikrotik.com/docs/CLI%20Reference/>. Elle expose les menus de commandes,
  drapeaux, noms d'arguments et types par paquet/chemin (par exemple,
  `/docs/CLI%20Reference/system/ip/address`). Traitez-la comme le compagnon lisible par l'humain
  de `/console/inspect` ; en cas de désaccord avec un routeur actif,
  `/console/inspect` de ce routeur prime.
- Pour les détails de l'API REST : voir la compétence `routeros-fundamentals` → [modèles d'API REST](../routeros-fundamentals/references/rest-api-patterns.md)
- Pour exécuter un CHR à interroger : voir la compétence `routeros-qemu-chr`
- Pour le format YAML /app (fonctionnalité visible dans l'arborescence sous 7.22+) : voir la compétence `routeros-app-yaml`
