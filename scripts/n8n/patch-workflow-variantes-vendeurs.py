#!/usr/bin/env python3
"""Deux versions de Mikhmon : SF v1 avec vendeurs et gérant, V3 sans.

La variante du routeur (donnée par le SaaS) conditionne :
- génération : lots distincts par vendeur uniquement en SF v1 ;
- rapport : détail par vendeur et copies vendeurs uniquement en
  SF v1. En V3, lot unique et rapport de zone pour l'admin seul.

Ajouts seulement, ancrages vérifiés, sauvegarde horodatée.
Usage : python3 scripts/n8n/patch-workflow-variantes-vendeurs.py
"""

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"


def une_fois(texte, ancre, remplacement, etiquette):
    n = texte.count(ancre)
    if n != 1:
        sys.exit(f"ECHEC {etiquette} : ancre trouvee {n} fois (attendu 1).")
    return texte.replace(ancre, remplacement)


def main():
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    for requis in ("Paramètres Mikhmon", "Générer les tickets dans RouterOS",
                   "Calculer le rapport des ventes",
                   "Envoyer le rapport des ventes"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")
    params = noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"]
    if "varianteMikhmon" in params:
        sys.exit("ECHEC : variante déjà branchée.")

    params = une_fois(
        params,
        "  input.vendeursZone = Array.isArray(livraisonJob.vendeursZone) ? livraisonJob.vendeursZone.map(String) : [];",
        "  input.vendeursZone = Array.isArray(livraisonJob.vendeursZone) ? livraisonJob.vendeursZone.map(String) : [];\n"
        "  input.varianteMikhmon = String((reponseJob.mikhmon || {}).variante || routeurJob.variante || '');",
        "params variante entree",
    )
    params = une_fois(
        params,
        "  vendeursZone: Array.isArray(input.vendeursZone) ? input.vendeursZone.map(String) : []\n};",
        "  vendeursZone: Array.isArray(input.vendeursZone) ? input.vendeursZone.map(String) : [],\n"
        "  varianteMikhmon: String(input.varianteMikhmon || '')\n};",
        "params variante shared",
    )
    noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"] = params

    generer = noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"]
    generer = une_fois(
        generer,
        "const commentairesVendeurs = (cfg, cleLot) => { var v = vendeursDe(cfg); if (!v.length) return null;",
        "const commentairesVendeurs = (cfg, cleLot) => { if (String(cfg.varianteMikhmon || '') !== 'sf-v1') return null; var v = vendeursDe(cfg); if (!v.length) return null;",
        "generer variante",
    )
    noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"] = generer

    calculer = noeuds["Calculer le rapport des ventes"]["parameters"]["jsCode"]
    calculer = une_fois(
        calculer,
        "var lotVendeur = {};",
        "var avecVendeurs = String(routeur.variante || '') === 'sf-v1';\n  var lotVendeur = {};",
        "calculer variante",
    )
    calculer = une_fois(
        calculer,
        "copie.parVendeur = Object.keys(parVendeur).sort()",
        "copie.parVendeur = (avecVendeurs ? Object.keys(parVendeur).sort() : [])",
        "calculer par vendeur variante",
    )
    noeuds["Calculer le rapport des ventes"]["parameters"]["jsCode"] = calculer

    envoyer = noeuds["Envoyer le rapport des ventes"]["parameters"]["jsCode"]
    envoyer = une_fois(
        envoyer,
        "ajouter(zone.numeroAdmin, texteGestion);\n    ajouter(zone.numeroGerant, texteGestion);",
        "ajouter(zone.numeroAdmin, texteGestion);\n    if (String((cfg.routeur || {}).variante || '') === 'sf-v1') ajouter(zone.numeroGerant, texteGestion);",
        "envoyer gerant variante",
    )
    envoyer = une_fois(
        envoyer,
        "for (const v of (zone.numerosVendeurs || [])) ajouter(v, texteVendeurPour(String(v)));",
        "if (String((cfg.routeur || {}).variante || '') === 'sf-v1') { for (const v of (zone.numerosVendeurs || [])) ajouter(v, texteVendeurPour(String(v))); }",
        "envoyer vendeurs variante",
    )
    noeuds["Envoyer le rapport des ventes"]["parameters"]["jsCode"] = envoyer

    horodatage = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    shutil.copyfile(FICHIER, str(FICHIER) + "." + horodatage + ".bak")
    FICHIER.write_text(json.dumps(donnees, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    print("OK : comportement par variante (SF v1 avec vendeurs, V3 sans).")


if __name__ == "__main__":
    main()
