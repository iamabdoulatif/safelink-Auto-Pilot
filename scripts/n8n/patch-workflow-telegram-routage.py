#!/usr/bin/env python3
"""Routage Telegram : callbacks invalides accuses, textes exacts.

- Aiguiller : un callback invalide (prof:/qty: inconnu, ou callback sans
  donnees) rend route 'ackErreur' avec 'Erreur de sélection.' au lieu
  d'une aide muette (le sablier Telegram restait bloque).
- Aide : quantite sans profil affiche exactement
  « Sélectionnez d’abord un profil. ».
- Router : 6e regle 'ackErreur' -> nouveau node « Accuser l'erreur »
  (clone d'« Accuser le profil », answerCallbackQuery 'Erreur de
  sélection.'), puis Aide.
- Accusers : repli d'erreur unifie 'Erreur de sélection.' (textes
  principaux distincts conserves).
- Aucun renommage, meme fichier (pas de nouveau workflow).

Idempotent : quitte 0 sans rien ecrire si deja applique.
Sauvegarde avant ecriture dans /tmp/sauvegarde-workflow-*.
Utilisation : python3 scripts/n8n/patch-workflow-telegram-routage.py
"""
import copy
import json
import shutil
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
TG = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"

MSG_SELECTION = "Sélectionnez d\u2019abord un profil."
MSG_ERREUR = "Erreur de sélection."

ANCIEN_TEXTE_AIDE = (
    "'Quantité ' + $json.qty + ' reçue : touchez d\\u2019abord un profil "
    "(03-JOURS, 01-SEMAINE, 01-MOIS), puis la quantité.'"
)

ANCIEN_PROF_INVALIDE = (
    "if (PROFILS.indexOf(profil) === -1) "
    "return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });"
)
ANCIEN_QTY_INVALIDE = (
    "if (PROFILS.indexOf(pq) === -1 || QUOTAS.indexOf(qq) === -1) "
    "return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });"
)
ANCIENNE_FIN = "return base({ route: 'help' });"

ACK_ERREUR = (
    "return base({ route: 'ackErreur', errorCode: 'ERREUR_SELECTION', "
    "errorText: '" + MSG_ERREUR + "', callbackQueryId: idRequeteCallback });"
)


def charger():
    with open(TG, encoding="utf-8") as f:
        return json.load(f)


def ecrire(doc):
    sauvegarde = (
        Path("/tmp")
        / ("sauvegarde-workflow-" + TG.stem + "-" + str(int(time.time())))
    )
    shutil.copyfile(TG, sauvegarde)
    print("Sauvegarde : " + str(sauvegarde))
    with open(TG, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")


def noeud(doc, nom):
    for n in doc["nodes"]:
        if n["name"] == nom:
            return n
    raise SystemExit("Node introuvable : " + nom)


doc = charger()
applique = False

# 1) Aiguiller : callbacks invalides -> ackErreur.
aig = noeud(doc, "Aiguiller")
js = aig["parameters"]["jsCode"]
if ANCIEN_PROF_INVALIDE in js:
    js = js.replace(
        ANCIEN_PROF_INVALIDE,
        "if (PROFILS.indexOf(profil) === -1) " + ACK_ERREUR,
    )
    applique = True
    print("Aiguiller : prof: inconnu accuse.")
if ANCIEN_QTY_INVALIDE in js:
    js = js.replace(
        ANCIEN_QTY_INVALIDE,
        "if (PROFILS.indexOf(pq) === -1 || QUOTAS.indexOf(qq) === -1) "
        + ACK_ERREUR,
    )
    applique = True
    print("Aiguiller : qty: inconnu accuse.")
if "if (idRequeteCallback) " + ACK_ERREUR not in js and js.rstrip().endswith(
    ANCIENNE_FIN
):
    js = js.rstrip()[: -len(ANCIENNE_FIN)].rstrip() + "\nif (idRequeteCallback) " + ACK_ERREUR + "\n" + ANCIENNE_FIN
    applique = True
    print("Aiguiller : callback sans donnees accuse.")
aig["parameters"]["jsCode"] = js

# 2) Aide : message exact quantite sans profil.
aide = noeud(doc, "Aide")
texte = aide["parameters"]["text"]
if ANCIEN_TEXTE_AIDE in texte:
    aide["parameters"]["text"] = texte.replace(
        ANCIEN_TEXTE_AIDE, "'" + MSG_SELECTION + "'"
    )
    applique = True
    print("Aide : message « Sélectionnez d’abord un profil. ».")

# 3) Router : 6e regle.
routeur = noeud(doc, "Router")
regles = routeur["parameters"]["rules"]["values"]
if not any(
    r["conditions"]["conditions"][0].get("rightValue") == "ackErreur"
    for r in regles
):
    modele = copy.deepcopy(regles[4])
    modele["conditions"]["conditions"][0]["rightValue"] = "ackErreur"
    modele["conditions"]["conditions"][0]["id"] = str(uuid.uuid4())
    modele["outputKey"] = "Erreur de sélection"
    regles.append(modele)
    doc["connections"]["Router"]["main"].append(
        [{"node": "Accuser l'erreur", "type": "main", "index": 0}]
    )
    applique = True
    print("Router : regle ackErreur.")

# 4) Nouveau node « Accuser l'erreur » (clone, pas de renommage).
if "Accuser l'erreur" not in {n["name"] for n in doc["nodes"]}:
    modele = copy.deepcopy(noeud(doc, "Accuser le profil"))
    modele["name"] = "Accuser l'erreur"
    modele["id"] = str(uuid.uuid4())
    modele["position"] = [560, 800]
    code = modele["parameters"]["jsCode"]
    code = code.replace("text: 'Profil sélectionné'", "text: '" + MSG_ERREUR + "'")
    code = code.replace("text: 'Erreur, réessayez.'", "text: '" + MSG_ERREUR + "'")
    modele["parameters"]["jsCode"] = code
    doc["nodes"].append(modele)
    doc["connections"]["Accuser l'erreur"] = {
        "main": [[{"node": "Aide", "type": "main", "index": 0}]]
    }
    applique = True
    print("Node « Accuser l'erreur » cree (-> Aide).")

# 5) Replis d'erreur unifies dans les deux Accusers existants.
for nom in ("Accuser le profil", "Accuser la quantité"):
    code = noeud(doc, nom)["parameters"]["jsCode"]
    if "text: 'Erreur, réessayez.'" in code:
        noeud(doc, nom)["parameters"]["jsCode"] = code.replace(
            "text: 'Erreur, réessayez.'", "text: '" + MSG_ERREUR + "'"
        )
        applique = True
        print(nom + " : repli unifie.")

if not applique:
    print("Routage : deja applique.")
else:
    ecrire(doc)
print("OK : routage corrige (ou deja present).")
