---
name: routeros-syntax-inspection
description: "Inspection et validation de la syntaxe des commandes/scripts RouterOS via un appareil actif avec /console/inspect (highlight, completion, syntax, child) et :parse IL. À utiliser pour : valider les commandes RouterOS avant exécution, expliquer ou vérifier (lint) les scripts RouterOS, construire des outils sensibles à la syntaxe (serveurs LSP, validateurs, commandes agent explain/check), interpréter les flux de jetons highlight ou le langage intermédiaire :parse, découvrir les valeurs d'énumérations ou les schémas d'arguments, ou lorsque l'utilisateur mentionne console/inspect, highlight tokens, parseIL, ou la validation de scripts RouterOS."
---

# Inspection de la syntaxe RouterOS

## Aperçu

RouterOS expose son **propre analyseur** via l'API REST : `/console/inspect`
classe chaque octet de l'entrée console (`highlight`), propose des suites
(`completion`), retourne l'aide structurée (`syntax`) et énumère l'arborescence
des commandes (`child`) ; la commande de script `:parse` retourne le langage
intermédiaire (IL) que le moteur exécute réellement. Ensemble, ils constituent
la vérité terrain pour « est-ce du RouterOS valide ? » — exacte pour la version,
exacte pour les paquets, et même exacte pour l'état d'exécution, ce qu'aucune
grammaire statique ne peut offrir.

Cette compétence est un **guide de choix de sonde et de format de transmission** : quelle surface
répond à quelle question, comment lire chaque réponse, et quelles affirmations les
réponses étayent ou n'étayent pas. Elle est fondée sur des captures de corpus complet
(913 scripts × plusieurs versions de RouterOS) publiées dans
[tikoci/lsp-routeros-ts](https://github.com/tikoci/lsp-routeros-ts) — les
`docs/` de ce dépôt portent les preuves complètes [^1].

**« Analyser du RouterOS » n'est pas une seule opération.** Choisissez la sonde selon la question :

| Question | Sonde | Ce qu'elle ne peut pas établir |
|---|---|---|
| Quel segment est une commande, un argument, une variable, un commentaire, un marqueur d'état actif ? | `request=highlight` | La structure imbriquée ; la validité des valeurs ; tout ce qui suit la première erreur dure |
| Le script est-il structurellement valide ; quels blocs/expressions en résultent ? | `:parse` | Les plages de source ; l'IL partiel sur erreur ; la séparation chemin/argument sans données de schéma |
| Qu'est-ce qui est valide à cette position du curseur ? Les valeurs d'énumération ? | `request=completion` | Le caractère obligatoire ; l'exhaustivité des listes de candidats ; l'acceptation à l'exécution |
| Quels chemins, commandes, arguments existent sur cet appareil ? | `request=child` + `request=syntax` | Les valeurs d'énumération (celles-ci viennent de `completion`) ; les arguments obligatoires |
| Quels arguments sont obligatoires ? | Sonde d'exécution par erreur (`add` sans arguments) | Les obligations conditionnelles après le premier discriminateur |

Détails par surface : [references/highlight.md](references/highlight.md),
[references/parseil.md](references/parseil.md),
[references/command-schema.md](references/command-schema.md),
[references/validation.md](references/validation.md).

Pour explorer toute la hiérarchie des commandes (parcours `child`, génération de schéma/RAML/OpenAPI),
voir la compétence **`routeros-command-tree`** — cette compétence couvre les surfaces
*syntaxe/validité* du même point de terminaison `/console/inspect`.

## Forme de la requête

REST (authentification basique, tout RouterOS 7.x) :

```text
POST /rest/console/inspect
{"request": "highlight" | "completion" | "syntax" | "child",
 "input": "<console input>",     // optional
 "path":  "ip,address,add"}      // optional comma-joined menu tokens
```

API native — les quatre mêmes modes sous forme de mots `=request=` / `=path=` :

```text
/console/inspect
  =request=child
  =path=ip,address
```

**`path` accepte des jetons de menu joints par des virgules, jamais une commande à barres obliques.** Seule la
forme à virgules parcourt le menu : `system,license` retourne les nœuds de ce menu, tandis que
`system/license` et `/system/license` ne retournent rien sur les deux transports, et
un corps JSON en tableau (`{"path":["system","license"]}`) retourne silencieusement le
listing **racine** — une mauvaise réponse qui ressemble à une réponse réussie. Mesuré
sur 7.23.7 ; la forme à virgules a été confirmée indépendamment sur 7.23.1 [^5].

Chaque réponse réussie est un tableau JSON d'objets plats tout-chaînes (REST) ou
une phrase `!re` par élément (natif). Les lignes `highlight`, `completion` et `syntax`
portent un champ `type` nommant le type de requête ; `request=child` utilise à la place
`type` pour le rôle de la ligne (`self`/`child`) et signale la classe du nœud dans
`node-type`. Au-delà, les quatre formes de réponse ne partagent rien — traitez-les
comme quatre API derrière un même point de terminaison.

## Version de référence et sécurité

- **Référence : RouterOS 7.20.8** — une version du canal long terme, utilisée ici comme
  plancher recommandé : le IL de parse et le comportement des chemins à plantage ci-dessous ont été capturés sur
  elle [^1][^3]. REST existe depuis 7.1beta4 (HTTPS uniquement au début [^2]) ;
  en dessous de 7.20.8, le comportement est au mieux (7.9.2 a été mesuré mais plus rude — voir
  [references/highlight.md](references/highlight.md)), et RouterOS v6 n'a pas
  d'API REST du tout.
- **Définissez toujours un délai d'attente par requête** (quelques secondes). Les anciennes versions peuvent bloquer
  tout le serveur REST sur des appels inspect spécifiques ; un serveur bloqué rend aussi
  les sondes *suivantes* sans rapport apparemment défectueuses.
- **Dangers connus** (tous mesurés, voir [^1] et [^3]) :

| Danger | Versions | Règle |
|---|---|---|
| `request=syntax`/`completion` sur le chemin nu `do` bloque le serveur REST | ≤ 7.20.8 (corrigé en 7.21.4) [^3] | Ignorez les chemins de mots-clés de script (`where`, `do`, `else`, `rule`, `command`, `on-error`) sur les versions anciennes/inconnues ; c'est une politique d'exclusion conservatrice, pas une règle de six chemins à plantage intemporelle |
| `request=syntax` avec `input`, ou `syntax` au niveau commande, cale ~60 s | observé sur 7.9.2 | Interrogez `syntax` par `path` uniquement ; détectez les recherches au niveau commande avec un délai court |
| `input` au-delà de 32 767 octets rejeté | toutes | Redirigez les entrées surdimensionnées vers `:parse` (sans plafond) ou rejetez-les — ne surlignez jamais une copie tronquée en la présentant comme validant tout le script |
| Falaise de latence de highlight près de 28 Ko | observé sur 7.23.x | Préférez un pré-contrôle `:parse` pour les gros scripts (pas de telle falaise, pas de plafond de 32 Ko) |

- **Distinguez `[]`, le délai dépassé et l'échec de transport.** Un tableau vide est une
  vraie réponse (chemin inexistant) ; un délai dépassé n'en est pas une. Les confondre corrompt
  toute conclusion mise en cache.

## Lecture des résultats — règles pour éviter les affirmations erronées

Voici les comportements mesurés les plus souvent mal résumés :

1. **Les décalages et jetons sont en octets.** Les chaînes RouterOS sont mono-octet
   — la console n'a aucune notion d'Unicode. Highlight émet exactement un
   jeton par **octet** d'entrée, et completion compte `offset` en octets reçus
   sur le câble (UTF-8 via REST, donc les caractères non-ASCII occupent 2+ octets et
   désynchronisent les décalages d'octets des index de chaînes UTF-16/JS). Normalisez l'entrée en ASCII
   d'abord — remplacer chaque caractère > 127 par un octet ASCII (`?`) garde
   les positions de caractères de l'éditeur alignées sur les positions d'octets RouterOS.
2. **Une erreur dure, puis silence.** Highlight et `:parse` s'arrêtent à la
   première erreur dure. Highlight marque exactement un octet `error` et laisse
   le reste non classé (`none`) ; `:parse` retourne un message avec ligne/colonne
   et **aucun IL partiel**. Ni l'un ni l'autre ne donne plusieurs diagnostics d'erreur en un appel.
   Les marqueurs doux (`obj-*`, `variable-undefined`, `syntax-obsolete`) n'arrêtent
   pas la classification.
3. **`none` signifie non classé, pas « littéral valide ».** Highlight accepte
   une IP manifestement mauvaise comme `none`. La validité des valeurs est une autre couche.
4. **`obj-inactive` / `obj-disabled` / `obj-dynamic` sont des classifications d'état
   actif, pas des erreurs de grammaire.** Un service désactivé ou une route dynamique
   parfaitement valable sont des références valides. La sévérité diagnostique relève de la
   décision du consommateur — ne codez jamais ces cas en dur comme « syntaxe invalide ».
5. **Un `$name` non déclaré n'est généralement pas une erreur.** Il est classé
   `variable-parameter` (il peut être fourni à l'appel). Le signal « probablement une
   coquille » est `variable-undefined` — un identifiant non résolvable nu en
   position d'expression.
6. **Les candidats de completion sont des suggestions observées, pas des énumérations
   prouvées fermées.** Conservez la provenance « candidats observés » sauf preuve
   indépendante de fermeture.
7. **Les résultats dépendent de l'état.** Les classes de jetons et les candidats dépendent de la
   version RouterOS, des paquets installés et des drapeaux d'objets courants. Enregistrez
   la version + le manifeste des paquets avec tout résultat capturé ; un instantané d'un
   routeur n'est qu'approximativement valable pour un autre.

## Validation d'une commande via completion

La mécanique fondée du « vérifier avant d'exécuter » (détail complet :
[references/command-schema.md](references/command-schema.md)) :

- Sondez avec le curseur **immédiatement après le mot testé** — avant
  `=`, l'espace ou le jeton suivant. Les verdicts de completion sont locaux au curseur :
  avancer au-delà d'un mot invalide peut masquer sa sentinelle.
- Les lignes sentinelles (`preference:"-20"`, `completion` vide,
  `text:"unknown command"`/`"unknown parameter"`) classent **le mot à
  leur `offset`** — et apparaissent aussi *par anticipation* à la fin d'une entrée
  valide, donc leur seule présence n'est pas un verdict. Règle de décision (7.21+) :
  sentinelle sans candidat de complétion → nom inconnu ; sentinelle plus
  candidats au même décalage → préfixe ambigu ; candidats seuls → partiel
  valide ; un *chemin* inexistant retourne `[]` d'emblée.
- Détection de capacités sur anciennes versions : 7.9.2 émet la sentinelle unknown-*command*
  mais retourne un simple `[]` pour un *argument* typé inconnu.
- **Réussir le contrôle inspect est nécessaire, pas suffisant.** Il existe un
  écart mesuré inspect-vs-exécution : `/console/inspect` accepte des formes que l'appareil
  refuse à l'exécution (p. ex. `blackhole=yes` sur une route, là où
  l'exécution veut le drapeau nu `blackhole`) [^4]. Seule l'exécution sur une cible
  appropriée prouve l'acceptation à l'exécution.

## Pipeline minimal pour une « explication » de syntaxe

1. **Segmentez** l'entrée statiquement (trouvez les frontières de commandes ; conservez les décalages).
2. **highlight** l'entrée normalisée ASCII → segments lexicaux + première erreur.
3. **`:parse`** uniquement quand une structure ou un message d'erreur est nécessaire → IL imbriqué
   ou message ligne/colonne. Alignez son erreur avec l'octet d'erreur de highlight.
4. **`child`/`syntax`/`completion`** (ou un instantané de schéma de même version) →
   séparez les formes chemin/argument fusionnées de l'IL, énumérez les arguments, récupérez les énumérations.
5. **Enrichissez** avec la prose de docs/changelog — mais l'appareil actif prime pour ce que
   sa surface inspect expose ; seule l'exécution prouve l'acceptation à l'exécution.

Les étapes 1–2 suffisent pour une explication légère ; l'analyse blocs/portées exige 3 ;
une aide riche sur les commandes exige 4–5. Les sondes d'exécution (découverte des arguments obligatoires,
`/rest/execute`) modifient l'état — ne les exécutez que sur demande explicite contre une cible
appropriée.

Quelle que soit la profondeur, conservez la provenance avec chaque fait dérivé : sonde source,
version RouterOS + paquets, contexte de chemin, si l'affirmation est une réponse directe
ou dérivée, normalisation appliquée, troncature, et résultat
(`ok` / `empty` / `timeout` / `transport-error`).

## Références

- [references/highlight.md](references/highlight.md) — flux de jetons par octet :
  vocabulaire, modèle d'erreur, dépendance d'état, dérive.
- [references/parseil.md](references/parseil.md) — `:parse` IL : recette de
  lecture, grammaire, canonicalisations, comportement d'erreur.
- [references/command-schema.md](references/command-schema.md) —
  formes de réponse `child`/`syntax`/`completion`, découverte d'énumérations, sentinelles.
- [references/validation.md](references/validation.md) — sondage des arguments obligatoires
  et superposition des preuves actives vs statiques.

[^1]: Références complètes des formats avec artefacts de capture :
    [`highlight-format.md`](https://github.com/tikoci/lsp-routeros-ts/blob/main/docs/highlight-format.md),
    [`parseil-format.md`](https://github.com/tikoci/lsp-routeros-ts/blob/main/docs/parseil-format.md),
    [`inspect-shapes.md`](https://github.com/tikoci/lsp-routeros-ts/blob/main/docs/inspect-shapes.md)
    dans tikoci/lsp-routeros-ts — corpus de 913 scripts balayé sur 7.9.2/7.23.2/7.24rc2
    (highlight, formes inspect) et 7.20.8/7.22.1/7.23rc1 (parseIL).
[^2]: Introduction de l'API REST MikroTik dans 7.1beta4 :
    <https://help.mikrotik.com/docs/spaces/ROS/pages/47579162/REST+API>.
[^3]: Dossier de support MikroTik SUP-127641 ; données de sondes par version dans
    [tikoci/restraml](https://github.com/tikoci/restraml) (notes `deep-inspect.ts`
    `CRASH_PATHS` et `docs/<version>/deep-inspect.json`
    `crashPathsCrashed`) : `do` nu bloque `syntax`/`completion` sur 7.20.8 à
    128 Mo comme à 512 Mo de RAM ; les six chemins répondent instantanément sur 7.21.4+.
[^4]: [tikoci/bench-routeros-tools](https://github.com/tikoci/bench-routeros-tools)
    `REPORT.md` — le cas `blackhole=yes` inspect-vs-exécution.
[^5]: [tikoci/centrs](https://github.com/tikoci/centrs)
    `commands/api/AGENTS.md` — pointes de validation CHR 7.23.1 pour la forme `path`
    à virgules et pour `/execute` `as-string` sur les deux transports.
