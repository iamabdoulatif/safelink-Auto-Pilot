# Champs réels renvoyés par le routeur

Méthode : MCP `mcp-mikrotik` (`mikrotik_execute_command`, API native port 8728),
compte lecture seule `app-audit`.
Dernière tentative : 2026-11-03 — **routeur injoignable** (`Timed out after 10 seconds`
sur les 7 requêtes). Aucun champ ci-dessous n’est renseigné : ne pas inventer de valeurs,
relancer la collecte quand le routeur répond.

À relancer tel quel (une session MCP par chemin) :
`/system/resource/print`, `/system/health/print`, `/system/routerboard/print`,
`/interface/print`, `/interface/ethernet/print`, `/interface/wifi/print`,
`/interface/wireless/print`.

## /system/resource — EN ATTENTE (timeout)

## /system/health — EN ATTENTE (timeout)

## /system/routerboard — EN ATTENTE (timeout)

## /interface — EN ATTENTE (timeout)

## /interface/ethernet — EN ATTENTE (timeout)

## Radio Wi-Fi — EN ATTENTE (timeout)

Règle : tester `/interface/wifi/print` PUIS `/interface/wireless/print`,
retenir celui qui répond, ignorer l’autre. Verdict impossible pour l’instant :
les deux échouent par timeout.
