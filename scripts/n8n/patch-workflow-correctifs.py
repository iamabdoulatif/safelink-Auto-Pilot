#!/usr/bin/env python3
"""Correctifs revus des workflows n8n (Telegram + Mikhmon).

Telegram :
- active=false -> true (webhook seul, sans declencheur periodique) ;
- NORMALISER_PROFIL : ajoute "7 jours" et "30 jours" (et variantes),
  exiges par le routage "3/7/30 jours" -> profil RouterOS reel.
Mikhmon :
- remplace les `const env = ... => fallback` qui IGNORAIENT $env par
  une lecture $env en repli (la configuration signee SafeLink garde la
  priorite : input.* est lu avant env()). Le compose n8n ne definit pas
  N8N_BLOCK_ENV_ACCESS_IN_NODE, $env fonctionne dans les nodes Code.

Idempotent : quitte 0 sans rien ecrire si deja applique.
Sauvegarde avant ecriture dans /tmp/sauvegarde-workflow-*.
Utilisation : python3 scripts/n8n/patch-workflow-correctifs.py
"""
import json
import shutil
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
TG = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"
MIKHMON = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"

ANCIENNE_CARTE = (
    "NORMALISER_PROFIL = { '3 jours': '03-JOURS', '03 jours': '03-JOURS', "
    "'03-jours': '03-JOURS', '1 semaine': '01-SEMAINE', '01 semaine': "
    "'01-SEMAINE', '01-semaine': '01-SEMAINE', '1 mois': '01-MOIS', "
    "'01 mois': '01-MOIS', '01-mois': '01-MOIS' };"
)
NOUVELLE_CARTE = (
    "NORMALISER_PROFIL = { '3 jours': '03-JOURS', '03 jours': '03-JOURS', "
    "'03-jours': '03-JOURS', '7 jours': '01-SEMAINE', '07 jours': '01-SEMAINE', "
    "'07-jours': '01-SEMAINE', '1 semaine': '01-SEMAINE', '01 semaine': "
    "'01-SEMAINE', '01-semaine': '01-SEMAINE', '30 jours': '01-MOIS', "
    "'30-jours': '01-MOIS', '1 mois': '01-MOIS', '01 mois': '01-MOIS', "
    "'01-mois': '01-MOIS' };"
)

ANCIEN_ENV = (
    "const env = (name, fallback = '') => fallback; "
    "// $env bloque en runner externe : entrees body uniquement"
)
NOUVEL_ENV = (
    "const env = (name, fallback = '') => (($env && $env[name]) || fallback); "
    "// Entrees signees SafeLink d'abord, $env en repli (compose OK)."
)


def charger(chemin):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def ecrire(chemin, doc):
    sauvegarde = (
        Path("/tmp")
        / ("sauvegarde-workflow-" + chemin.stem + "-" + str(int(time.time())))
    )
    shutil.copyfile(chemin, sauvegarde)
    print("Sauvegarde : " + str(sauvegarde))
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")


def noeud(doc, nom):
    for n in doc["nodes"]:
        if n["name"] == nom:
            return n
    raise SystemExit("Node introuvable : " + nom)


def corriger_telegram():
    doc = charger(TG)
    applique = False
    if doc.get("active") is not True:
        doc["active"] = True
        applique = True
        print("Telegram : active=false -> true.")
    js = noeud(doc, "Aiguiller")["parameters"]["jsCode"]
    if ANCIENNE_CARTE in js:
        noeud(doc, "Aiguiller")["parameters"]["jsCode"] = js.replace(
            ANCIENNE_CARTE, NOUVELLE_CARTE
        )
        applique = True
        print("Telegram : saisies '7 jours' / '30 jours' reconnues.")
    if not applique:
        print("Telegram : deja applique.")
        return False
    ecrire(TG, doc)
    return True


def corriger_mikhmon():
    doc = charger(MIKHMON)
    applique = False
    for nom in ("Paramètres Mikhmon", "Lire la demande (profil + quantité)"):
        js = noeud(doc, nom)["parameters"]["jsCode"]
        if ANCIEN_ENV in js:
            noeud(doc, nom)["parameters"]["jsCode"] = js.replace(ANCIEN_ENV, NOUVEL_ENV)
            applique = True
            print("Mikhmon : $env relu dans « " + nom + " ».")
    if not applique:
        print("Mikhmon : deja applique.")
        return False
    ecrire(MIKHMON, doc)
    return True


if __name__ == "__main__":
    corriger_telegram()
    corriger_mikhmon()
    print("OK : correctifs appliques (ou deja presents).")
