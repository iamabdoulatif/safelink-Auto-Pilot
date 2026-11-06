# Rôles dans l'espace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les rôles Admin / Contributeur / Utilisateur dans chaque espace client, avec invitations par l'Admin, sélecteur d'espace et contrôles serveur par action.

**Architecture:** Table `membres_espace (tenant_id, courriel, role)` ; le créateur de l'espace est Admin. Le rôle se résout côté serveur (`lib/membres.ts`) à partir de la session : jamais depuis le client. Repli : le propriétaire d'un espace (tenant = son courriel) est Admin même sans ligne de membre (comptes existants). Les routes mutantes déclarent le rôle minimum requis. Un sélecteur d'espace dans la navigation permet de basculer entre ses espaces (nouveau cookie de session).

**Tech Stack:** Next.js 16, PostgreSQL (`pg`), migrations maison, tests `node --test`.

---

### Task 1: Base — membres d'espace (migration 020)

**Files:**
- Create: `db/migrations/020-membres-espace.sql`

- [ ] Table `membres_espace (tenant_id, courriel, role CHECK admin|contributeur|utilisateur, invite_par, created_at, PRIMARY KEY (tenant_id, courriel))`.
- [ ] Backfill : `INSERT ... SELECT tenant_id, utilisateur_id, 'admin' FROM espaces ON CONFLICT DO NOTHING`.
- [ ] `npm test` (racine) : ordre et non-destructif OK.

### Task 2: Lib membres + test unitaire

**Files:**
- Create: `web/lib/membres.ts`, `web/lib/membres.test.ts`

- [ ] `ROLES = ["admin","contributeur","utilisateur"]`, `roleAutorise(role, minimum)` hiérarchie admin > contributeur > utilisateur (test pur).
- [ ] `roleDansEspace(tenantId, courriel)` : ligne membre, sinon `admin` si tenant = courriel, sinon `null`.
- [ ] `listerMembres`, `listerEspacesDe(courriel)` (rôle + nom d'espace = propriétaire).
- [ ] Test : hiérarchie des rôles (2 cas passants).

### Task 3: Inscription = Admin de son espace

**Files:**
- Modify: `web/lib/auth.ts` (`inscrireCompte`)

- [ ] Après insertion de l'utilisateur : `INSERT INTO membres_espace ... 'admin' ON CONFLICT DO NOTHING`.

### Task 4: API membres (Admin seulement)

**Files:**
- Create: `web/app/api/membres/route.ts` (GET liste + POST invitation)
- Create: `web/app/api/membres/[courriel]/route.ts` (PATCH rôle, DELETE retrait)

- [ ] Garde : `session()` + `roleDansEspace === "admin"` sinon 403.
- [ ] POST : courriel normalisé + rôle valide ; refuse d'inviter un superadmin plateforme ; crée la ligne (invitation en attente d'inscription si le compte n'existe pas).
- [ ] PATCH/DELETE : impossible de retirer ou rétrograder le dernier Admin de l'espace (le propriétaire).

### Task 5: API espaces + bascule de session

**Files:**
- Create: `web/app/api/espaces/route.ts` (GET mes espaces)
- Create: `web/app/api/espaces/choisir/route.ts` (POST : vérifie le membre, réémet le cookie avec le tenant choisi via `cookiePourCompte`)

### Task 6: Gardes par action sur les routes mutantes

**Files (Modify, ajouter le contrôle après `session()`):**
- Admin seulement : `api/configuration/*` (POST), `api/connexions-mikhmon` (POST/PATCH/DELETE), `api/installations-mikhmon/*` (POST), `api/parc/[id]` (PATCH/DELETE), `api/reapprovisionnement` (POST/PATCH), `api/parametres-compte` (POST).
- Admin + Contributeur : `api/generer-tickets` (POST), `api/tickets/*` (POST/PATCH), `api/tickets/approbations/[id]` (POST).
- Helper dans chaque route : `if (!(await roleAutorisePour(ctx, "admin"))) return 403 { error: "Rôle insuffisant…" }` via `lib/membres.ts`.

### Task 7: Interface — page Membres et sélecteur d'espace

**Files:**
- Create: `web/app/(application)/membres/page.tsx` (liste, badges rôle Admin orange / Contributeur lime / Utilisateur gris, invitation, changement de rôle, retrait ; message clair pour les non-Admins)
- Create: `web/components/selecteur-espace.tsx` (client : liste `/api/espaces`, visible si > 1 espace, POST choisir puis refresh)
- Modify: `web/components/nav-principale.tsx` (sélecteur sous le logo + lien « Membres et rôles » dans le groupe Compte)
- Modify: `web/app/(application)/admin/utilisateurs/*` : inchangé (superadmin plateforme).

### Task 8: Vérification de bout en bout

- [ ] Base temporaire : patron (Admin) invite contributeur + utilisateur ; le contributeur génère (OK) mais ne configure pas (403) ; l'utilisateur ne génère pas (403) ; bascule d'espace effective.
- [ ] `npx tsc --noEmit`, eslint ciblé, `npm run build`, `npm test` racine.
- [ ] Captures relues : page Membres (Admin), sélecteur d'espace.
