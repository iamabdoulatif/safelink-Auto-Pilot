---
name: routeros-scripting
description: "Langage de script RouterOS et idiomes de configuration CLI pour les fichiers .rsc et les commandes interactives. À utiliser pour : écrire ou relire des scripts RouterOS, des extraits de planificateur/netwatch/sur-événement, de la config CLI idempotente, la syntaxe :local/:global/:foreach/:do, les sélecteurs [find], la gestion de print as-value, les permissions de script, ou quand l'utilisateur mentionne .rsc, script RouterOS, astuces de script ou automatisation de config CLI."
---

# Script & config CLI RouterOS

Les scripts RouterOS (`.rsc`, `/system/script`, `on-event` du planificateur, hooks Netwatch et
extraits CLI interactifs) utilisent le langage propre à RouterOS. Ce n'est **ni du shell, ni du Lua, ni du Python,
ni du Tcl**. Pour la base de syntaxe, voir [references/syntax.md](./references/syntax.md).
Cette skill se concentre sur les pièges que les LLM risquent de rater avec assurance.

## Ne pas utiliser les numéros de ligne interactifs dans les scripts

La sortie interactive de `print` affiche des numéros de ligne temporaires (`0`, `1`, `2`...) pour le
tampon de console courant. Ce ne sont **pas des ID d'objets stables** et ils ne sont pas utilisables dans les
scripts.

```routeros
# WRONG in scripts — "1" is only an interactive print-buffer row number
/ip/route/set 1 gateway=3.3.3.3

# Better — internal IDs have a * prefix, but can change if objects are removed/re-added
/ip/route/set *1 gateway=3.3.3.3

# Best — resolve the target at runtime
/ip/route/set [find dst-address="0.0.0.0/0"] gateway=3.3.3.3
```

Pour la config générée, utilisez des sélecteurs stables comme `comment=`, `name=` ou une valeur unique
d'adresse/liste. Les ID internes sont visibles dans `print as-value` sous la forme `.id=*HEX`.

## Considérer les résultats `[find]` comme des tableaux d'ID

`[find ...]` renvoie zéro, un ou plusieurs ID internes. Beaucoup de commandes acceptent ce
tableau directement (`set`, `remove`, `disable`), mais le code qui a besoin d'exactement un objet
devrait vérifier le compte avant `get`.

```routeros
:local ids [/interface/find where name="ether1"]
:if ([:len $ids] = 1) do={
  :put [/interface/get ($ids->0) name]
} else={
  :error ("expected exactly one interface, got " . [:len $ids])
}
```

Utilisez `[find comment="my-tool-tag"]` pour le nettoyage idempotent, pas des sélecteurs larges comme
`[find dynamic=no]` qui peuvent supprimer de la configuration utilisateur sans rapport.

## Mettre les préfixes IP entre guillemets dans `find` / `where`

RouterOS fait une conversion de type agressive, mais pas toujours dans le sens attendu.
Pour `/ip/address`, la propriété `address` est stockée comme une chaîne incluant la longueur de préfixe.
Un littéral non quoté comme `111.111.1.1/24` est une valeur de préfixe IP et peut ne rien correspondre.

```routeros
# WRONG — can silently return nothing
/ip/address/print where address=111.111.1.1/24

# Correct
/ip/address/print where address="111.111.1.1/24"

# Correct when value came from a variable
:local prefix 111.111.1.1/24
/ip/address/print where address=[:tostr $prefix]
```

Quand une requête ne renvoie rien de façon inattendue, inspectez le type stocké :

```routeros
:put [:typeof ([:pick [/ip/address/print as-value] 0]->"address")]
```

## `print as-value` est généralement un tableau de tables

`print as-value where ...` renvoie `{{...}; {...}}`, même quand une seule ligne correspond.
Choisissez une ligne avant d'accéder à une propriété.

```routeros
# WRONG — tries to read "gateway" from the outer array
:put ([/ip/route/print as-value where gateway="ether1"]->"gateway")

# Correct — pick the first map, then read the property
:put ([:pick [/ip/route/print as-value where gateway="ether1"] 0]->"gateway")
```

Pour les commandes sans `get`, `as-value` est souvent la seule sortie exploitable en script :

```routeros
:put ([/tool/fetch url="https://example.com/file.txt" output=user as-value]->"data")
```

## Les commandes de supervision exigent `once do={...}`

Des commandes comme `monitor-traffic` sont des boucles interactives sauf instruction de ne tourner qu'une fois.
Utilisez `once do={}` pour capturer leurs valeurs temporaires dans un script. Les noms de champs à traits
d'union utilisent `$"name-with-hyphens"`.

```routeros
/interface/monitor-traffic ether1 once do={
  :put ("rx=" . $"rx-bits-per-second")
}
```

Utilisez `:log`, pas seulement `:put`, pour les scripts de planificateur ou de hook où aucun terminal n'est
attaché.

## Les globales doivent être redéclarées là où elles sont lues

Les variables globales et fonctions globales ne sont pas automatiquement visibles dans un autre
script ou corps de fonction. Déclarez l'accès avec `:global name;` avant de les lire ou de
les appeler.

```routeros
:global state "ready"
:global showState do={
  :global state
  :put ("state=" . $state)
}

:global addOne do={ :return ($1 + 1) }
:global caller do={
  :global addOne
  :return [$addOne 5]
}
```

Utilisez des noms de variables uniques. Évitez les noms qui entrent en collision avec les propriétés RouterOS comme
`dst-address` ; si vous devez accéder à une telle variable, utilisez la syntaxe de variable quotée
(`$"dst-address"`).

## Les tableaux ne sont pas des tableaux JavaScript

```routeros
# Empty array: {} is a syntax error
:local arr [:toarray ""]

# Indexing and assignment use ->
:set ($arr->"name") "router1"
:put ($arr->"name")
```

La concaténation de chaînes avec `.` se distribue sur les tableaux sauf conversion préalable :

```routeros
:local arr {"a"; "b"}
:put ("value=" . $arr)          # two outputs: value=a and value=b
:put ("value=" . [:tostr $arr]) # one output: value=a;b
```

Les clés nommées sont triées par ordre alphabétique. Les éléments non nommés conservent l'ordre d'insertion mais
sont déplacés avant les éléments à clés.

## Les fichiers ont des limites propres à la CLI

RouterOS n'a pas de primitive directe de « création de fichier vide » ou d'ajout. La solution documentée
crée un fichier via `print file=...`, puis écrit `contents=`.

```routeros
/file/print file=myFile
/file/set myFile.txt contents=""
```

Pour ajouter, lisez le contenu existant, concaténez, puis réécrivez tout le fichier. Les gros fichiers et le contenu binaire conviennent mal aux scripts RouterOS ; préférez `/tool/fetch`,
REST, SCP/SFTP ou un outillage externe quand c'est possible.

## Les stratégies de script font partie de la justesse

Les hooks du planificateur, Netwatch, `on-up` PPP et similaires s'exécutent avec des stratégies limitées.
Si un script a besoin des droits sur les fichiers, sauvegardes, mots de passe, capture ou redémarrage, l'appelant
doit avoir la stratégie correspondante.

```routeros
/system/script/add name=backup policy=read,write,ftp,sensitive source={
  /system/backup/save name=daily
}
```

Soyez prudent avec `dont-require-permissions=yes` : cela permet à des appelants moins privilégiés
d'exécuter le script avec le jeu de stratégies propre au script. Ne l'utilisez que pour des scripts
volontairement bornés.

## Valider la forme des commandes avant exécution

Pour les attributs, drapeaux inconnus et commandes dépendant des paquets :

1. Préférez la nouvelle référence CLI du manuel MikroTik :
   <https://manual.mikrotik.com/docs/CLI%20Reference/>
2. Pour un routeur réel ou une version exacte de RouterOS, `/console/inspect` est la vérité de
   terrain. Voir la skill `routeros-command-tree`.
3. Quand c'est disponible, utilisez le MCP `rosetta` (`routeros_explain_command`,
   `routeros_command_tree`) pour une explication en lecture seule avant exécution.
4. En cas de doute et si un CHR local est disponible, utilisez `quickchr exec <name> '<command>'`
   sur une instance jetable avant de publier le script.

## Docs officielles à revoir d'abord

- Nouvel accueil du manuel RouterOS : <https://manual.mikrotik.com/> — remplace au fil du temps la documentation
  `help.mikrotik.com` basée sur Confluence.
- Astuces de script :
  <https://manual.mikrotik.com/docs/Developer%20Guides/Scripting/scripting-tips-and-tricks/>
- Exemples de script :
  <https://manual.mikrotik.com/docs/Developer%20Guides/Scripting/scripting-examples/>
- Référence CLI :
  <https://manual.mikrotik.com/docs/CLI%20Reference/> — schéma de commandes/propriétés navigable
  organisé par paquet et chemin de commande.
