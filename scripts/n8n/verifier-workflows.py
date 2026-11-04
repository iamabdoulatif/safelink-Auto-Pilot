#!/usr/bin/env python3
"""Verifie la coherence des workflows n8n SANS aucun appel reseau.

Controles : JSON valide, ids uniques, connexions vers des nodes
existants, aucun node orphelin, boutons inline conformes
(replyMarkup/rows/row/buttons/callback_data), answerCallbackQuery sur
chaque callback, routage "7/30 jours", $env relu (jamais ignore),
seuil 50 par defaut, signature HMAC exigee, contrat SafeLink complet.
Utilisation : python3 scripts/n8n/verifier-workflows.py
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
TG = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"
MIKHMON = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"
TICKETS_TS = RACINE / "web" / "lib" / "tickets.ts"

erreurs = []


def signaler(message):
    erreurs.append(message)
    print("ECHEC : " + message)


def charger(chemin):
    try:
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        signaler(str(chemin) + " illisible : " + str(e))
        return None


def codes(doc):
    return {
        n["name"]: (n.get("parameters", {}) or {}).get("jsCode", "")
        for n in doc["nodes"]
        if n["type"] == "n8n-nodes-base.code"
    }


def verifier_graphe(nom, doc):
    noms = [n["name"] for n in doc["nodes"]]
    if len(noms) != len(set(noms)):
        signaler(nom + " : noms de nodes dupliques.")
    ids = [n.get("id") for n in doc["nodes"]]
    if len(ids) != len(set(ids)):
        signaler(nom + " : ids de nodes dupliques.")
    ens = set(noms)
    for src, v in doc.get("connections", {}).items():
        if src not in ens:
            signaler(nom + " : connexion depuis un node inconnu : " + src)
        for sorties in (v.get("main", []) if isinstance(v, dict) else []):
            for c in sorties or []:
                if (c.get("node") or "") not in ens:
                    signaler(nom + " : connexion vers un node inconnu : " + str(c.get("node")))
    declencheurs = {
        n["name"]
        for n in doc["nodes"]
        if n["type"].endswith(".webhook")
        or "trigger" in n["type"].lower()
        or "Trigger" in n["type"]
    }
    cibles = set()
    for v in doc.get("connections", {}).values():
        for sorties in (v.get("main", []) if isinstance(v, dict) else []):
            for c in sorties or []:
                cibles.add(c.get("node"))
    for n in noms:
        if n not in cibles and n not in declencheurs:
            signaler(nom + " : node orphelin (aucune entree) : " + n)


def verifier_telegram(doc):
    if doc.get("active") is not True:
        signaler("telegram : active=false (non activable).")
    js = codes(doc).get("Aiguiller", "")
    for attendue in ("askRouters", "routeur:", "prof:", "qty:"):
        if attendue not in js:
            signaler("telegram : Aiguiller sans routage catalogue : " + attendue + ".")
    brut = json.dumps(doc, ensure_ascii=False)
    for statique in ("03-JOURS", "01-SEMAINE", "01-MOIS", "NORMALISER_PROFIL",
                     "Profil non tarifé", "TELEGRAM_ALLOWED_ID"):
        if statique in brut:
            signaler("telegram : liste statique ou repli interdit : " + statique + ".")
    for node_attendu, appel in (
        ("Lister les routeurs", "/api/telegram/catalogue"),
        ("Proposer les profils", "/api/telegram/catalogue"),
        ("Vérifier l'utilisateur", "/api/telegram/autoriser"),
    ):
        if appel not in codes(doc).get(node_attendu, ""):
            signaler("telegram : « " + node_attendu + " » sans appel " + appel + ".")
    verifier_js = codes(doc).get("Vérifier l'utilisateur", "")
    if "routerId" not in verifier_js:
        signaler("telegram : autorisation sans routerId (génération aveugle).")
    for n in doc["nodes"]:
        if n["type"] != "n8n-nodes-base.telegram":
            continue
        params = n.get("parameters", {}) or {}
        clavier = params.get("inlineKeyboard")
        if params.get("replyMarkup") == "inlineKeyboard":
            try:
                for ligne in clavier["rows"]:
                    for bouton in ligne["row"]["buttons"]:
                        if "callback_data" not in bouton.get("additionalFields", {}):
                            signaler("telegram : bouton sans callback_data dans « " + n["name"] + " ».")
            except (KeyError, TypeError, AttributeError):
                signaler("telegram : structure inline invalide dans « " + n["name"] + " ».")
    for nom in ("Accuser le profil", "Accuser la quantité"):
        if "answerCallbackQuery" not in codes(doc).get(nom, ""):
            signaler("telegram : « " + nom + " » sans answerCallbackQuery.")
    if "Accuser l'erreur" not in {n["name"] for n in doc["nodes"]}:
        signaler("telegram : node « Accuser l'erreur » absent.")
    elif "Erreur de sélection." not in codes(doc).get("Accuser l'erreur", ""):
        signaler("telegram : « Accuser l'erreur » sans le texte exige.")
    for attendue, texte in (
        ("Accuser le profil", "Profil sélectionné"),
        ("Accuser la quantité", "Quantité sélectionnée"),
    ):
        if texte not in codes(doc).get(attendue, ""):
            signaler("telegram : texte distinct manquant dans « " + attendue + " ».")
    aide = next((n for n in doc["nodes"] if n["name"] == "Aide"), None)
    if aide and "Sélectionnez d\u2019abord un profil." not in json.dumps(
        aide.get("parameters", {}), ensure_ascii=False
    ):
        signaler("telegram : Aide sans le message exact exige.")
    brut = json.dumps(doc, ensure_ascii=False)
    if re.search(r"\b\d{8,12}:[A-Za-z0-9_-]{30,}", brut):
        signaler("telegram : token Telegram dans l'export.")
    for n in doc["nodes"]:
        for nom, secret in (n.get("credentials", {}) or {}).items():
            if isinstance(secret, dict) and secret.get("id"):
                continue
            if secret:
                signaler("telegram : secret en dur dans « " + n["name"] + " ».")
    routeur = next((n for n in doc["nodes"] if n["name"] == "Router"), None)
    cles = set()
    if routeur:
        for regle in (routeur.get("parameters", {}) or {}).get("rules", {}).get("values", []):
            for cond in regle.get("conditions", {}).get("conditions", []):
                cles.add(cond.get("rightValue"))
    for attendue in ("askRouters", "askProfiles", "askQty", "generate", "help"):
        if attendue not in cles:
            signaler("telegram : regle Router manquante : " + attendue + ".")


def verifier_mikhmon(doc):
    for nom, js in codes(doc).items():
        if "=> fallback" in js:
            signaler("mikhmon : « " + nom + " » ignore $env.")
    parametres = codes(doc).get("Paramètres Mikhmon", "")
    if "TICKET_THRESHOLD', 50" not in parametres and 'TICKET_THRESHOLD", 50' not in parametres:
        signaler("mikhmon : seuil 50 par defaut introuvable.")
    if "cleIdempotence" not in codes(doc).get("Générer les tickets dans RouterOS", ""):
        signaler("mikhmon : idempotence par cle absente de la generation.")
    if "RouterOS" not in parametres or "source" not in parametres.lower():
        signaler("mikhmon : source de verite RouterOS non documentee.")
    noms = {n["name"] for n in doc["nodes"]}
    if "Vérifier la signature" not in noms:
        signaler("mikhmon : node « Vérifier la signature » absent.")


def verifier_syntaxe(nom, doc):
    # Chaque node Code doit rester du JS valide : enveloppe async car
    # les fragments utilisent return/await de premier niveau (contexte n8n).
    for n in doc["nodes"]:
        js = (n.get("parameters", {}) or {}).get("jsCode", "")
        if not js:
            continue
        with tempfile.NamedTemporaryFile(
            "w", suffix=".js", delete=False, encoding="utf-8"
        ) as f:
            f.write("async function __verif($input, $env) {\n" + js + "\n}\n")
            chemin = f.name
        try:
            ok = subprocess.run(
                ["node", "--check", chemin], capture_output=True
            )
            if ok.returncode != 0:
                signaler(nom + " : JS invalide dans « " + n["name"] + " » : "
                          + ok.stderr.decode("utf-8", "replace").strip()[:300])
        finally:
            Path(chemin).unlink(missing_ok=True)


def verifier_securite(nom, doc):
    for n in doc["nodes"]:
        js = (n.get("parameters", {}) or {}).get("jsCode", "")
        if not js:
            continue
        if "Math.random" in js:
            signaler(nom + " : Math.random dans « " + n["name"] + " ».")
        if "skipSslCertificateValidation: true" in js:
            signaler(nom + " : TLS desactive en dur dans « " + n["name"] + " ».")
    if nom == "mikhmon":
        gen = next((n for n in doc["nodes"]
                    if n["name"] == "Générer les tickets dans RouterOS"), None)
        js = (gen.get("parameters", {}) or {}).get("jsCode", "") if gen else ""
        if "esc(" not in js:
            signaler("mikhmon : echappement HTML absent de la generation.")


def verifier_contrat():
    try:
        src = TICKETS_TS.read_text(encoding="utf-8")
    except OSError as e:
        signaler("tickets.ts illisible : " + str(e))
        return
    for champ in (
        "userId", "tenantId", "profile", "quantity", "routerConnectionId",
        "mikhmonConnectionId", "deliveryChannel", "recipient", "runId",
        "signature", "callbackUrl",
    ):
        if champ not in src:
            signaler("contrat : champ absent de tickets.ts : " + champ + ".")


tg = charger(TG)
mikhmon = charger(MIKHMON)
if tg:
    verifier_graphe("telegram", tg)
    verifier_telegram(tg)
    verifier_syntaxe("telegram", tg)
    verifier_securite("telegram", tg)
if mikhmon:
    verifier_graphe("mikhmon", mikhmon)
    verifier_mikhmon(mikhmon)
    verifier_syntaxe("mikhmon", mikhmon)
    verifier_securite("mikhmon", mikhmon)
verifier_contrat()

if erreurs:
    print(str(len(erreurs)) + " erreur(s).")
    sys.exit(1)
print("OK : workflows coherents (aucun appel reseau effectue).")
