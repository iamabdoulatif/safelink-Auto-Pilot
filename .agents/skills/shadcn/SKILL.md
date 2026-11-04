---
name: shadcn
description: Gère les composants et projets shadcn — ajout, recherche, correction, débogage, stylage et composition d'UI, y compris les interfaces de chat. Fournit le contexte du projet, la documentation des composants et des exemples d'utilisation. S'applique quand on travaille avec shadcn/ui, les registres de composants, les presets, les codes --preset ou tout projet avec un fichier components.json. Se déclenche aussi pour « shadcn init », « create an app with --preset », « switch to --preset », et pour construire un design system ou appliquer un DESIGN.md ou une charte de marque à shadcn/ui.
user-invocable: false
allowed-tools: Bash(npx shadcn@latest *), Bash(pnpm dlx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# shadcn/ui

Un framework pour construire des interfaces, des composants et des design systems. Les composants sont ajoutés en tant que code source au projet de l'utilisateur via la CLI.

> **IMPORTANT :** Exécutez toutes les commandes CLI en utilisant l'exécuteur de paquets du projet : `npx shadcn@latest`, `pnpm dlx shadcn@latest` ou `bunx --bun shadcn@latest` — selon le `packageManager` du projet. Les exemples ci-dessous utilisent `npx shadcn@latest`, mais substituez l'exécuteur correct pour le projet.

## Contexte actuel du projet

```json
!`npx shadcn@latest info --json`
```

Le JSON ci-dessus contient la configuration du projet et les composants installés. Utilisez `npx shadcn@latest docs <component>` pour obtenir la documentation et des exemples d'URL pour chaque composant.

## Principes

1. **Utiliser d'abord les composants existants.** Utilisez `npx shadcn@latest search` pour vérifier les registres avant d'écrire une UI personnalisée. Vérifiez aussi les registres communautaires.
2. **Composer, ne pas réinventer.** Page de paramètres = Tabs + Card + contrôles de formulaire. Tableau de bord = Sidebar + Card + Chart + Table.
3. **Utiliser les variantes intégrées avant les styles personnalisés.** `variant="outline"`, `size="sm"`, etc.
4. **Utiliser des couleurs sémantiques.** `bg-primary`, `text-muted-foreground` — jamais de valeurs brutes comme `bg-blue-500`.

## Règles critiques

Ces règles sont **toujours appliquées**. Chacune renvoie vers un fichier avec des paires de code Incorrect/Correct.

### Styles & Tailwind → [styling.md](./rules/styling.md)

- **`className` pour la mise en page, pas pour le stylage.** Ne remplacez jamais les couleurs ni la typographie des composants.
- **Pas de `space-x-*` ni de `space-y-*`.** Utilisez `flex` avec `gap-*`. Pour les piles verticales, `flex flex-col gap-*`.
- **Utilisez `size-*` quand la largeur et la hauteur sont égales.** `size-10`, pas `w-10 h-10`.
- **Utilisez le raccourci `truncate`.** Pas `overflow-hidden text-ellipsis whitespace-nowrap`.
- **Pas de remplacements manuels de couleurs `dark:`.** Utilisez des jetons sémantiques (`bg-background`, `text-muted-foreground`).
- **Utilisez `cn()` pour les classes conditionnelles.** N'écrivez pas de ternaires manuelles dans des littéraux de gabarit.
- **Pas de `z-index` manuel sur les composants superposés.** Dialog, Sheet, Popover, etc. gèrent leur propre empilement.

### Formulaires & champs → [forms.md](./rules/forms.md)

- **Les formulaires utilisent `FieldGroup` + `Field`.** N'utilisez jamais un `div` brut avec `space-y-*` ou `grid gap-*` pour la mise en page des formulaires.
- **`InputGroup` utilise `InputGroupInput`/`InputGroupTextarea`.** Jamais de `Input`/`Textarea` brut dans `InputGroup`.
- **Les boutons dans les champs utilisent `InputGroup` + `InputGroupAddon`.**
- **Les jeux d'options (2 à 7 choix) utilisent `ToggleGroup`.** Ne bouclez pas sur `Button` avec un état actif manuel.
- **`FieldSet` + `FieldLegend` pour regrouper les cases à cocher/radios liées.** N'utilisez pas un `div` avec un titre.
- **La validation des champs utilise `data-invalid` + `aria-invalid`.** `data-invalid` sur `Field`, `aria-invalid` sur le contrôle. Pour désactivé : `data-disabled` sur `Field`, `disabled` sur le contrôle.

### Structure des composants → [composition.md](./rules/composition.md)

- **Les éléments toujours dans leur groupe.** `SelectItem` → `SelectGroup`. `DropdownMenuItem` → `DropdownMenuGroup`. `CommandItem` → `CommandGroup`.
- **Utilisez `asChild` (radix) ou `render` (base) pour les déclencheurs personnalisés.** Vérifiez le champ `base` depuis `npx shadcn@latest info`. → [base-vs-radix.md](./rules/base-vs-radix.md)
- **Dialog, Sheet et Drawer ont toujours besoin d'un titre.** `DialogTitle`, `SheetTitle`, `DrawerTitle` requis pour l'accessibilité. Utilisez `className="sr-only"` si masqué visuellement.
- **Utilisez la composition complète de Card.** `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`. Ne versez pas tout dans `CardContent`.
- **Button n'a pas de `isPending`/`isLoading`.** Composez avec `Spinner` + `data-icon` + `disabled`.
- **`TabsTrigger` doit être dans `TabsList`.** Ne rendez jamais les déclencheurs directement dans `Tabs`.
- **`Avatar` a toujours besoin de `AvatarFallback`.** Pour quand l'image ne charge pas.

### Utiliser les composants, pas le balisage personnalisé → [composition.md](./rules/composition.md)

- **Utilisez les composants existants avant le balisage personnalisé.** Vérifiez si un composant existe avant d'écrire un `div` stylé.
- **Les encadrés utilisent `Alert`.** Ne construisez pas de divs stylés personnalisés.
- **Les états vides utilisent `Empty`.** Ne construisez pas de balisage d'état vide personnalisé.
- **Toast suit la base du projet.** Utilisez `toast` depuis le composant `toast` pour les projets Base UI. Utilisez `toast()` depuis `sonner` pour les projets Radix et React Aria.
- **Utilisez `Separator`** au lieu de `<hr>` ou `<div className="border-t">`.
- **Utilisez `Skeleton`** pour les espaces réservés de chargement. Pas de divs `animate-pulse` personnalisés.
- **Utilisez `Badge`** au lieu de spans stylés personnalisés.

### Icônes → [icons.md](./rules/icons.md)

- **Les icônes dans `Button` utilisent `data-icon`.** `data-icon="inline-start"` ou `data-icon="inline-end"` sur l'icône.
- **Pas de classes de taille sur les icônes dans les composants.** Les composants gèrent la taille des icônes via CSS. Pas de `size-4` ni de `w-4 h-4`.
- **Passez les icônes comme des objets, pas des clés de chaîne.** `icon={CheckIcon}`, pas une recherche par chaîne.

### Chat & messagerie → [chat.md](./rules/chat.md)

- **L'UI de chat compose les primitives de chat.** Les conversations utilisent `MessageScroller`, les lignes utilisent `Message`, les surfaces utilisent `Bubble`. Jamais de `div` de bulle artisanale ni de conteneur de défilement brut.
- **`MessageScroller` possède le comportement de défilement.** Le suivi du streaming, l'ancrage et le saut au plus récent (`MessageScrollerButton`) sont intégrés. N'écrivez pas de hook `useStickToBottom`/`ResizeObserver`.
- **Les pièces jointes utilisent `Attachment` ; les notes système et séparateurs utilisent `Marker`.** Pas de cartes `Item` ni de `Separator` + étiquette.
- **L'activité de l'assistant utilise `Trace`.** Raisonnement, appels d'outils, sources et étapes sont des `TraceLine` dans un `Trace`, un `Trace` par série de parties de message. Le comportement enveloppe la ligne : `TraceCollapsible`, un déclencheur de feuille ou un lien. Pas un `Collapsible` artisanal ni un `Marker`.

### CLI

- **Ne décodez jamais les codes de preset ni ne construisez les URL de preset manuellement.** Utilisez `npx shadcn@latest preset decode <code>`, `preset url <code>` ou `preset open <code>`. Pour la détection de preset sensible au projet, utilisez `npx shadcn@latest preset resolve`.
- **Appliquez les codes de preset directement avec la CLI.** Utilisez `npx shadcn@latest apply <code>` pour les projets existants, ou `npx shadcn@latest init --preset <code>` lors de l'initialisation.

## Motifs clés

Ce sont les motifs les plus courants qui distinguent le code shadcn/ui correct. Pour les cas limites, voir les fichiers de règles liés ci-dessus.

```tsx
// Form layout: FieldGroup + Field, not div + Label.
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" />
  </Field>
</FieldGroup>

// Validation: data-invalid on Field, aria-invalid on the control.
<Field data-invalid>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid />
  <FieldDescription>Invalid email.</FieldDescription>
</Field>

// Icons in buttons: data-icon, no sizing classes.
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

// Spacing: gap-*, not space-y-*.
<div className="flex flex-col gap-4">  // correct
<div className="space-y-4">           // wrong

// Equal dimensions: size-*, not w-* h-*.
<Avatar className="size-10">   // correct
<Avatar className="w-10 h-10"> // wrong

// Status colors: Badge variants or semantic tokens, not raw colors.
<Badge variant="secondary">+20.1%</Badge>    // correct
<span className="text-emerald-600">+20.1%</span> // wrong
```

## Sélection des composants

| Besoin                       | Utiliser                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Bouton/action                | `Button` avec la variante appropriée                                                                 |
| Champs de formulaire         | `Input`, `Select`, `Combobox`, `Switch`, `Checkbox`, `RadioGroup`, `Textarea`, `InputOTP`, `Slider` |
| Bascule entre 2 à 5 options  | `ToggleGroup` + `ToggleGroupItem`                                                                   |
| Affichage de données         | `Table`, `Card`, `Badge`, `Avatar`                                                                  |
| Navigation                   | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination`                                     |
| Surcouches                   | `Dialog` (modale), `Sheet` (panneau latéral), `Drawer` (tiroir inférieur), `AlertDialog` (confirmation) |
| Retour d'information         | `toast` (Base UI), `sonner` (Radix/Aria), `Alert`, `Progress`, `Skeleton`, `Spinner`                 |
| Palette de commandes         | `Command` dans `Dialog`                                                                             |
| Graphiques                   | `Chart` (encapsule Recharts)                                                                        |
| Mise en page                 | `Card`, `Separator`, `Resizable`, `ScrollArea`, `Accordion`, `Collapsible`                          |
| États vides                  | `Empty`                                                                                             |
| Menus                        | `DropdownMenu`, `ContextMenu`, `Menubar`                                                            |
| Info-bulles/infos            | `Tooltip`, `HoverCard`, `Popover`                                                                   |
| UI de chat / conversation    | `MessageScroller`, `Message`, `Bubble`, `Attachment`, `Marker`, `Trace`                             |

## Champs clés

Le contexte de projet injecté contient ces champs clés :

- **`aliases`** → utilisez le préfixe d'alias réel pour les imports (p. ex. `@/`, `~/`), jamais en dur.
- **`isRSC`** → quand `true`, les composants utilisant `useState`, `useEffect`, des gestionnaires d'événements ou des API de navigateur ont besoin de `"use client"` en haut du fichier. Référez-vous toujours à ce champ pour la directive.
- **`tailwindVersion`** → `"v4"` utilise des blocs `@theme inline` ; `"v3"` utilise `tailwind.config.js`.
- **`tailwindCssFile`** → le fichier CSS global où les variables CSS personnalisées sont définies. Modifiez toujours ce fichier, n'en créez jamais un nouveau.
- **`style`** → traitement visuel des composants (p. ex. `nova`, `vega`).
- **`base`** → bibliothèque de primitives (`radix` ou `base`). Affecte les API des composants et les props disponibles.
- **`iconLibrary`** → détermine les imports d'icônes. Utilisez `lucide-react` pour `lucide`, `@tabler/icons-react` pour `tabler`, etc. Ne supposez jamais `lucide-react`.
- **`resolvedPaths`** → destinations exactes sur le système de fichiers pour les composants, utilitaires, hooks, etc.
- **`framework`** → conventions de routage et de fichiers (p. ex. Next.js App Router vs Vite SPA).
- **`packageManager`** → utilisez-le pour toute installation de dépendance non-shadcn (p. ex. `pnpm add date-fns` vs `npm install date-fns`).
- **`preset`** → code et valeurs de preset résolus pour le projet actuel. Utilisez `npx shadcn@latest preset resolve --json` quand vous n'avez besoin que des informations de preset.

Voir [cli.md — commande `info`](./cli.md) pour la référence complète des champs.

## Documentation, exemples et usage des composants

Exécutez `npx shadcn@latest docs <component>` pour obtenir les URL de la documentation, des exemples et de la référence API d'un composant. Récupérez ces URL pour obtenir le contenu réel.

```bash
npx shadcn@latest docs button dialog select
```

**Lors de la création, correction, débogage ou utilisation d'un composant, exécutez toujours `npx shadcn@latest docs` et récupérez d'abord les URL.** Cela garantit que vous travaillez avec l'API et les motifs d'usage corrects plutôt qu'au hasard.

## Flux de travail

1. **Obtenir le contexte du projet** — déjà injecté ci-dessus. Exécutez de nouveau `npx shadcn@latest info` si vous devez actualiser.
2. **Vérifier d'abord les composants installés** — avant d'exécuter `add`, vérifiez toujours la liste `components` du contexte du projet ou listez le répertoire `resolvedPaths.ui`. N'importez pas de composants qui n'ont pas été ajoutés, et ne ré-ajoutez pas ceux déjà installés.
3. **Trouver des composants** — `npx shadcn@latest search`.
4. **Obtenir docs et exemples** — exécutez `npx shadcn@latest docs <component>` pour obtenir les URL, puis récupérez-les. Utilisez `npx shadcn@latest view` pour parcourir les éléments de registre non installés. Pour prévisualiser les modifications des composants installés, utilisez `npx shadcn@latest add --diff`.
5. **Installer ou mettre à jour** — `npx shadcn@latest add`. Lors de la mise à jour de composants existants, utilisez `--dry-run` et `--diff` pour prévisualiser d'abord les modifications (voir [Mise à jour des composants](#updating-components) ci-dessous).
6. **Corriger les imports dans les composants tiers** — Après avoir ajouté des composants depuis des registres communautaires (p. ex. `@bundui`, `@magicui`), vérifiez les fichiers non-UI ajoutés pour des chemins d'import en dur comme `@/components/ui/...`. Ils ne correspondront pas aux alias réels du projet. Utilisez `npx shadcn@latest info` pour obtenir le bon alias `ui` (p. ex. `@workspace/ui/components`) et réécrivez les imports en conséquence. La CLI réécrit les imports pour ses propres fichiers UI, mais les composants de registres tiers peuvent utiliser des chemins par défaut qui ne correspondent pas au projet.
7. **Relire les composants ajoutés** — Après avoir ajouté un composant ou un bloc depuis n'importe quel registre, **lisez toujours les fichiers ajoutés et vérifiez qu'ils sont corrects**. Vérifiez les sous-composants manquants (p. ex. `SelectItem` sans `SelectGroup`), les imports manquants, la composition incorrecte ou les violations des [Règles critiques](#critical-rules). Remplacez aussi tout import d'icône par le `iconLibrary` du projet depuis le contexte du projet (p. ex. si l'élément de registre utilise `lucide-react` mais que le projet utilise `hugeicons`, échangez les imports et les noms d'icônes en conséquence). Corrigez tous les problèmes avant de continuer.
8. **Le registre doit être explicite** — Quand l'utilisateur demande d'ajouter un bloc ou un composant, **ne devinez pas le registre**. Si aucun registre n'est précisé (p. ex. l'utilisateur dit « ajoute un bloc de connexion » sans préciser `@shadcn`, `@tailark`, `owner/repo`, etc.), demandez quel registre utiliser. Ne choisissez jamais un registre par défaut à la place de l'utilisateur.
9. **Changement de presets** — Demandez d'abord à l'utilisateur : **écraser**, **partiel**, **fusionner** ou **ignorer** ?
   - **Inspecter le preset actuel** : `npx shadcn@latest preset resolve`. Utilisez `--json` quand vous avez besoin de valeurs structurées.
   - **Inspecter le preset entrant** : `npx shadcn@latest preset decode <code>`. Utilisez `preset url <code>` ou `preset open <code>` pour partager ou ouvrir le constructeur de preset.
   - **Écraser** : `npx shadcn@latest apply <code>`. Écrase les composants, polices et variables CSS détectés.
   - **Partiel** : `npx shadcn@latest apply <code> --only theme,font`. Ne met à jour que les parties de preset sélectionnées sans réinstaller les composants UI. Les valeurs prises en charge sont `theme` et `font` ; les combinaisons séparées par des virgules sont autorisées. `icon` n'est volontairement pas pris en charge, car les changements d'icônes peuvent exiger une réinstallation complète des composants et des transformations.
   - **Fusionner** : `npx shadcn@latest init --preset <code> --force --no-reinstall`, puis exécutez `npx shadcn@latest info` pour lister les composants installés, puis pour chaque composant installé utilisez `--dry-run` et `--diff` pour le [fusionner intelligemment](#updating-components) individuellement.
   - **Ignorer** : `npx shadcn@latest init --preset <code> --force --no-reinstall`. Ne met à jour que la config et le CSS, laisse les composants tels quels.
   - **Important** : Exécutez toujours les commandes de preset dans le répertoire du projet de l'utilisateur. `apply` ne fonctionne que dans un projet existant avec un fichier `components.json`. La CLI préserve automatiquement la base actuelle (`base` vs `radix`) depuis `components.json`. Si vous devez utiliser un répertoire temporaire/scratch (p. ex. pour des comparaisons `--dry-run`), passez `--base <current-base>` explicitement — les codes de preset n'encodent pas la base.

## Design systems depuis DESIGN.md

Quand l'utilisateur demande un design system depuis un `DESIGN.md` (ou une charte de marque), avec ou sans preset, suivez [design-system.md](./design-system.md) de bout en bout :

1. `init --preset <code> --template <vite|next> --name <app> --no-monorepo -y`. Sans code de preset, choisissez le style le plus proche et passez `--base base --preset <style>`. Puis `add --all -y`.
2. Lisez le frontmatter du DESIGN.md, les À faire et À ne pas faire, et les lacunes connues avant de modifier.
3. Mappez ses jetons sur les variables shadcn dans `tailwindCssFile`. Épinglez l'échelle de rayons, les ombres, les polices et les utilitaires `type-*`.
4. Restylez les composants en modifiant leurs variantes `cva`. Changez les hauteurs de contrôle ensemble.
5. Construisez la page de design system selon [design-system-page.md](./design-system-page.md) : rôles de couleur vérifiés au contraste, spécimens typographiques, matrices d'états épinglées, cas limites, paires à faire/à ne pas faire, recettes. Vérifiez la couverture avec `scripts/showcase-coverage.mjs`.
6. Vérifiez dans un navigateur : vérification des types, pas d'erreurs console, charge en haut, pas de débordement horizontal, mode sombre.

## Mise à jour des composants

Quand l'utilisateur demande à mettre à jour un composant depuis l'amont tout en gardant ses modifications locales, utilisez `--dry-run` et `--diff` pour fusionner intelligemment. **Ne récupérez JAMAIS les fichiers bruts depuis GitHub manuellement — utilisez toujours la CLI.**

1. Exécutez `npx shadcn@latest add <component> --dry-run` pour voir tous les fichiers qui seraient affectés.
2. Pour chaque fichier, exécutez `npx shadcn@latest add <component> --diff <file>` pour voir ce qui a changé en amont vs en local.
3. Décidez par fichier selon le diff :
   - Pas de modifications locales → écrasement sûr.
   - A des modifications locales → lisez le fichier local, analysez le diff, et appliquez les mises à jour amont tout en préservant les modifications locales.
   - L'utilisateur dit « mets juste tout à jour » → utilisez `--overwrite`, mais confirmez d'abord.
4. **N'utilisez jamais `--overwrite` sans l'approbation explicite de l'utilisateur.**

## Référence rapide

```bash
# Create a new project.
npx shadcn@latest init --name my-app --preset base-nova
npx shadcn@latest init --name my-app --preset a2r6bw --template vite

# Create a design system app (then follow design-system.md).
npx shadcn@latest init --name my-ds --preset b0 --template vite --no-monorepo -y
npx shadcn@latest init --name my-ds --base base --preset maia --template vite --no-monorepo -y
npx shadcn@latest add --all -y

# Create a monorepo project.
npx shadcn@latest init --name my-app --preset base-nova --monorepo
npx shadcn@latest init --name my-app --preset base-nova --template next --monorepo

# Initialize existing project.
npx shadcn@latest init --preset base-nova
npx shadcn@latest init --defaults  # shortcut: --template=next --preset=nova (base style implied)

# Apply a preset to an existing project.
npx shadcn@latest apply a2r6bw
npx shadcn@latest apply a2r6bw --only theme
npx shadcn@latest apply a2r6bw --only font
npx shadcn@latest apply a2r6bw --only theme,font

# Inspect preset codes and project preset state.
npx shadcn@latest preset decode a2r6bw
npx shadcn@latest preset url a2r6bw
npx shadcn@latest preset open a2r6bw
npx shadcn@latest preset resolve
npx shadcn@latest preset resolve --json

# Add components.
npx shadcn@latest add button card dialog
npx shadcn@latest add @magicui/shimmer-button
npx shadcn@latest add owner/repo/item
npx shadcn@latest add --all

# Preview changes before adding/updating.
npx shadcn@latest add button --dry-run
npx shadcn@latest add button --diff button.tsx
npx shadcn@latest add @acme/form --view button.tsx
npx shadcn@latest add owner/repo/item --dry-run

# Search registries.
npx shadcn@latest search @shadcn -q "sidebar"
npx shadcn@latest search @tailark -q "stats"
npx shadcn@latest search owner/repo -q "login"
npx shadcn@latest search                          # all configured registries
npx shadcn@latest search @shadcn -q "menu" -t ui  # filter by item type

# Get component docs and example URLs.
npx shadcn@latest docs button dialog select

# View registry item details (for items not yet installed).
npx shadcn@latest view @shadcn/button
npx shadcn@latest view owner/repo/item
```

**Presets nommés :** `nova`, `vega`, `maia`, `lyra`, `mira`, `luma`
**Modèles :** `next`, `vite`, `start`, `react-router`, `astro` (tous prennent en charge `--monorepo`) et `laravel` (non pris en charge pour monorepo)
**Codes de preset :** chaînes base62 à préfixe de version (p. ex. `a2r6bw` ou `b0`), depuis [ui.shadcn.com](https://ui.shadcn.com).

## Références détaillées

- [rules/forms.md](./rules/forms.md) — FieldGroup, Field, InputGroup, ToggleGroup, FieldSet, états de validation
- [rules/composition.md](./rules/composition.md) — Groupes, surcouches, Card, Tabs, Avatar, Alert, Empty, Toast, Separator, Skeleton, Badge, chargement de Button
- [rules/chat.md](./rules/chat.md) — MessageScroller, Message, Bubble, Attachment, Marker, Trace ; streaming, ancrage, saut-au-plus-récent, lignes d'activité de l'assistant
- [rules/icons.md](./rules/icons.md) — data-icon, taille des icônes, passage des icônes comme objets
- [rules/styling.md](./rules/styling.md) — Couleurs sémantiques, variantes, className, espacement, taille, truncate, mode sombre, cn(), z-index
- [rules/base-vs-radix.md](./rules/base-vs-radix.md) — asChild vs render, Select, ToggleGroup, Slider, Accordion
- [cli.md](./cli.md) — Commandes, drapeaux, presets, modèles
- [registry.md](./registry.md) — Création de registres sources, `include`, définitions d'éléments, dépendances, règles de registre GitHub
- [customization.md](./customization.md) — Thématisation, variables CSS, extension des composants
- [design-system.md](./design-system.md) : DESIGN.md (avec ou sans preset) vers une app thématisée : choix de style, mappage de jetons, rayon, polices, échelle typographique, hauteurs de contrôle, pièges de vitrine, vérification
- [design-system-page.md](./design-system-page.md) : Contenu d'une page de design system et comment : fondations, paliers de composants, matrices d'états épinglées, paires de contraste, cas limites, à faire/à ne pas faire, recettes
