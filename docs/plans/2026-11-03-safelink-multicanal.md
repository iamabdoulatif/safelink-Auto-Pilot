# SafeLink multicanal — plan d'implémentation

> Compétence utilisée : writing-plans. Exécution : inline, sans sous-agent.

**Goal :** Mikhmon + RouterOS + Telegram + WhatsApp + PrintNode + réappro auto, isolés par tenant, sans doublon ni secret exposé.

**Architecture :** tables existantes étendues (migrations 007-008, jamais retouche 001-006) ; DAO déjà câblés (`runs-tickets`, `mikhmon-installations`, `connexions-routeur`, `bots-telegram`) ; `tickets.ts` porte le contrat 12 champs ; workflow patché par script rejouable avec `.bak` préalable.

**Tech Stack :** Next.js 16 App Router, TS strict sans `any`, `pg` + SQL manuel, shadcn existants (aucun ajout), `fetch` natif (aucune dépendance).

## Fichiers

- Créer : `db/migrations/007_reappro_historique.sql`, `008_canaux_whatsapp_printnode.sql`, `web/lib/whatsapp.ts`, `web/lib/printnode.ts`, `web/lib/historique.ts`, `web/app/api/connexions-mikhmon/route.ts`, `.../[id]/route.ts`, `.../[id]/tester/route.ts`, `web/app/api/routeurs-config/[id]/route.ts`, `.../tester/route.ts`, `.../profils/route.ts`, `web/app/api/configuration/whatsapp/route.ts`, `.../tester/route.ts`, `web/app/api/configuration/printnode/route.ts`, `.../tester/route.ts`, `web/app/api/tickets/historique/route.ts`, `web/app/api/telegram/webhook/route.ts`, `web/app/api/parametres/route.ts`, pages `/connexions-mikhmon`, `/routeurs`, `/profils-hotspot`, `/reappro`, `/configuration/whatsapp`, `/configuration/printnode`, `/historique`, `/diagnostics`, `/parametres`, `web/components/nav-principale.tsx`, `scripts/patch-workflow-multicanal.py`.
- Modifier (sauvegarde `.bak` avant chacun) : `web/lib/tickets.ts`, `web/lib/telegram.ts`, `web/lib/bots-telegram.ts`, `web/lib/runs-tickets.ts`, `web/app/api/tickets/lots/route.ts`, `web/app/api/tickets/auto/route.ts`, `web/app/api/tickets/abonnements/route.ts`, `web/app/api/n8n/retour/route.ts`, `web/app/api/configuration/telegram/route.ts`, `web/app/tickets/nouveau/page.tsx`, `web/app/layout.tsx`, `.env.example`, `workflow-mikhmon-patched.json`.
- Ne jamais : supprimer un fichier, toucher 001-006, mettre un secret dans `NEXT_PUBLIC_` ou un log.

## Tâches

### T1 — Migrations 007-008 (+ sauvegarde : aucune, créations)

007 : `ALTER configurations_routeurs ADD mot_de_passe_lecture_chiffre TEXT` ; `abonnements_tickets ADD configuration_routeur_id BIGINT REFERENCES configurations_routeurs(id) ON DELETE CASCADE, quantite_cible INT NOT NULL DEFAULT 120 CHECK (>0), telegram_chat_id/whatsapp_recipient/printnode_printer_id TEXT, derniere_verif_le TIMESTAMPTZ, dernier_stock INT, derniere_erreur TEXT` + CHECK canal IN (interface,telegram,whatsapp,printnode,pdf) en bloc DO ; `ticket_generation_runs ADD stock_avant/stock_apres/seuil/quantite_cible INT, destinataire/whatsapp_recipient/printnode_printer_id TEXT`.
008 : `CREATE TABLE configurations_whatsapp (tenant_id PK→espaces, webhook_url TEXT NOT NULL, secret_chiffre TEXT, destinataire_defaut TEXT NOT NULL DEFAULT '', actif BOOLEAN DEFAULT true, statut_connexion TEXT DEFAULT 'jamais-teste', dernier_test_le)` ; `CREATE TABLE configurations_printnode (tenant_id PK, cle_chiffre TEXT, printer_id INT, nom_imprimante TEXT, format_papier TEXT DEFAULT 'A4', actif, statut_connexion, dernier_test_le)` + CHECK format IN (A4,A5,Letter). Vérifier : parens équilibrées, rejouable (IF NOT EXISTS / DO).

### T2 — Libs whatsapp/printnode/historique + getChat (créations + 1 modif)

`web/lib/whatsapp.ts` : `validerEntree(url, destinataire, actif)` (URL http(s) ≤300, destinataire 1-128) ; `testerWebhook(url)` : GET serveur, injoignable→erreur, sinon `{joignable:true}` (aucun secret logué) ; `masquer`.
`web/lib/printnode.ts` : `validerEntree(cle, printerId, nom, format)` ; `testerImprimante(cle, printerId)` : GET `https://api.printnode.com/printers` Basic `cle:` → trouve l'id → `{nom}` sinon erreur ; jamais de log de clé.
`web/lib/historique.ts` : `listerHistorique(ctx, limite)` : SELECT runs LEFT JOIN lots ON lots.cle_idempotence=runs.run_id AND lots.tenant_id, ORDER created_at DESC, mapping sans secrets.
`web/lib/telegram.ts` (modifier, `.bak`) : ajouter `verifierChatId(jeton, chatId)` via `getChat` (ok+result.id → `{titre}` sinon erreur). `web/lib/bots-telegram.ts` (modifier, `.bak`) : après getMe, vérifier le chat (`verifierChatId`) en central (jeton env) et personnalisé, refuser sinon.

### T3 — Contrat 12 champs dans tickets.ts (modifier, `.bak`)

Étendre `DemandeLot` : `userId, mikhmonConnectionId, routerConnectionId, threshold, targetQuantity, telegramChatId, whatsappRecipient, printNodePrinterId, runId` + garder internes (`routeurNom, routeurUrlBase, routerUser, routerPassword, dureeLimite, volumeLimiteOctets, prefixe, jetonTelegram, clePrintNode, cleIdempotence`). `CanalLivraison` = 5 valeurs. `genererLot` : valide (runId 1-128, targetQuantity 1-500, seuils) ; INSERT lot (+prefixe, +destinataires whatsapp/printnode) ; INSERT run via `ticket_generation_runs` (`run_id`=runId, statut demande, stock_avant, seuil, cible) avec ON CONFLICT DO NOTHING → si ligne existante, retourner `{lot_id:0, execution_id:0, run_existant:true}` sans rappeler n8n ; charge = 12 champs + `routerBaseUrl/routerUser/routerPassword` + `jetonTelegram/clePrintNode` (corps signé serveur-à-serveur, jamais dans l'URL) + `callbackUrl/appelant` ; signature HMAC inchangée ; succès → lot `lance`, run `lance`.

### T4 — Routes génération + auto + abonnements + retour (modifier, `.bak`)

`lots/route.ts` : champs + `prefixe` (≤12, alphabet simple), + `mikhmon_connection_id`, canaux 5, contrôles config whatsapp (`actif`+testé sinon 409) / printnode (idem), destinataires par canal, récap enrichi (connexion Mikhmon, préfixe), passe les 12 champs.
`auto/route.ts` (réécriture) : lit abonnements `actif` + config jointe (nouveau chemin) puis legacy parc ; stock via `estNeuf` ; déclenche si `stock <= seuil` ; skip si stock >= cible ; verrou : run même `(tenant,config,profil)` en demande/lance OU lot récent 30 min OU runId du slot (`auto-<tenant>-<cfg>-<profil>-<slot15>`) déjà vu → ignore motivé ; quantité = cible (plafond 500) ; seuil/cible/stockAvant journalisés dans le run ; réponse `{data:{controles,declenches,ignores,erreurs}}`.
`abonnements/route.ts` : accepte `configuration_routeur_id, quantite_cible, telegram_chat_id, whatsapp_recipient, printnode_printer_id`, canaux 5, upsert par (tenant, config, profil) ou (tenant, routeur parc, profil).
`n8n/retour/route.ts` : corps + `runId, stockAvant, stockApres` ; MAJ lot (par cle) + run (statut, quantités, stocks, termine_le) + executions ; idempotence inchangée.

### T5 — Nouvelles routes (créations)

Chaque route : `{data}|{error}`, `session()` + `verifierContexte`, jamais de secret en réponse.
`connexions-mikhmon` (GET liste via `listerInstallations`, POST via `creerInstallation` + test serveur, défauts hote 127.0.0.1/port 8088 affichés côté UI, refus mikhmon/1234) ; `[id]` (GET/PUT/DELETE soft via DAO) ; `[id]/tester` (POST → `testerInstallation`).
`routeurs-config/[id]` (GET `lireConnexionRouteur`, PUT `enregistrerConnexionRouteur`) ; `tester` (POST body `motDePasseLecture` ou stock déchiffré) ; `profils` (GET via `listerProfilsHotspot`, mdp lecture stocké déchiffré serveur).
`configuration/whatsapp` (GET masqué, POST upsert + test), `tester` ; `configuration/printnode` (GET masqué, POST upsert + test réel), `tester`.
`tickets/historique` (GET → `listerHistorique`), `telegram/webhook` (POST vérifie `secret` vs `secretWebhookTelegram`, anti-doublon `webhooks_recus`, 200), `parametres` (GET/PUT via `lireReglages/enregistrerReglages`).

### T6 — Pages + navigation (créations + 2 modifs)

`nav-principale.tsx` (serveur, 12 liens) intégré dans `layout.tsx` (`.bak`). Pages : `/connexions-mikhmon` (formulaire nom/variante/hôte/port/URL auto/rôle/identifiant/mdp, alerte si mikhmon/1234, liste statuts+dates, boutons tester/désactiver) ; `/routeurs` (sélecteur config + section adresse/users/mdp/serveur + tester + profils) ; `/profils-hotspot` ; `/reappro` (table abonnements : stock/seuil/cible/canal/actif + dernière vérif + prochaine + statut + dernière erreur + dernier lot + interrupteurs) ; `/configuration/whatsapp`, `/configuration/printnode`, `/historique` (table runs+lots), `/diagnostics` (constats ouverts, requête directe comme `page.tsx`), `/parametres`. Étendre `tickets/nouveau` (`.bak`) : sélecteur connexion Mikhmon, préfixe, 5 canaux, phrase « Les tickets sont créés dans RouterOS et deviennent visibles dans Mikhmon. »

### T7 — Workflow (script + `.bak` horodaté)

`scripts/patch-workflow-multicanal.py` : P1 mappe `targetQuantity→quantity`, `whatsappRecipient→recipient` (si canal), `telegramChatId→recipient`, `runId→cleIdempotence` (déjà partiel : compléter), ajoute `userId/connectionIds` au partagé + commentaire ; P3 insère node getMe avant « Envoyer PDF Telegram » ; P5/P6 payload retour += `runId, stockAvant, stockApres` (stockApres compté dans « Générer » après création) et message « Préparer le récapitulatif » += routeur/stocks/date (lire le node avant) ; vérifier P2 (schedule actif : oui=True, documenter cron secours) ; tester les jsCode embarqués avec mocks comme précédemment ; ne jamais toucher `workflow-telegram-tickets.json`.

### T8 — Vérifications

`tsc --noEmit` (0), `eslint app lib components` (0), `next build --webpack` (exit 0), tests logiques `/tmp` (canon, HMAC, chiffrement, parseurs, validation), JSON workflow valide + mocks nodes, SQL relu, `.env.example` (noms seuls : ajouter `WHATSAPP_*`, `PRINTNODE_*`). Soins impossibles en sandbox (réseau/écoute bloqués) : tests 1-15 réels listés comme restants avec commandes exactes.

## Auto-contrôle

- Couverture : chaque exigence ci-dessus pointe une tâche (menus→T6, 12 champs→T3/T4, 10 étapes réappro→T4+P5/P6, anti-dup→T3/T4, message télégram→T7, historique→T2/T5/T6, tests→T8).
- Pas de doublon : réutilise DAO/workflows/routes ; `runs-tickets.ts` CANAUX étendu (pas de nouveau type canal).
- Cohérence types : `CanalLivraison` 5 valeurs partout ; `ContexteTenant` unique via `acces-donnees`.
