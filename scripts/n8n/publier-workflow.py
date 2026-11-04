#!/usr/bin/env python3
"""Publie le workflow Telegram dans n8n via son API publique.

Sans cle, l'API repond 401 : la cle n'existe pas dans le depot, elle se
cree dans l'interface n8n (avatar en bas a gauche -> Settings -> onglet
"n8n API" -> Create an API key, affichee une seule fois), puis se range
cote serveur uniquement (n8n/.env et .env.local racine : N8N_API_KEY=...,
jamais NEXT_PUBLIC_, jamais dans Git, jamais affichee).

Sans --publier : controles en lecture seule (cle valide, import prevu,
doublon de webhook). Avec --publier : cree ou met a jour le workflow
(recherche par nom exact), l'active, puis verifie qu'il est actif et
seul sur son webhook. Refuse d'activer en cas de doublon.

Utilisation :
  python3 scripts/n8n/publier-workflow.py [fichier]            # controle seul
  N8N_API_KEY=... python3 scripts/n8n/publier-workflow.py --publier
Variables : N8N_API_KEY (ou n8n/.env, .env.local),
  N8N_BASE_URL (defaut http://localhost:5678).
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
DEFAUT_FICHIER = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"

CREER_CLE = (
    "CLE_MANQUANTE : creer la cle dans n8n (http://localhost:5678 -> "
    "avatar -> Settings -> onglet \"n8n API\" -> Create an API key), "
    "puis la ranger dans n8n/.env et .env.local (N8N_API_KEY=...)."
)


def lire_env(chemin):
    valeurs = {}
    try:
        for ligne in Path(chemin).read_text(encoding="utf-8").splitlines():
            ligne = ligne.strip()
            if not ligne or ligne.startswith("#") or "=" not in ligne:
                continue
            cle, valeur = ligne.split("=", 1)
            valeurs[cle.strip()] = valeur.strip().strip("'\"")
    except OSError:
        pass
    return valeurs


def echec(code, message):
    print("ECHEC [" + code + "] : " + message)
    sys.exit(1)


def appel(base, cle, methode, chemin, corps=None):
    donnees = json.dumps(corps).encode("utf-8") if corps is not None else None
    requete = urllib.request.Request(
        base + chemin, data=donnees, method=methode,
        headers={"X-N8N-API-KEY": cle, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            brut = reponse.read().decode("utf-8") or "{}"
            return reponse.status, json.loads(brut)
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode("utf-8") or "{}")
            message = str(detail.get("message", e))
        except ValueError:
            message = str(e)
        return e.code, {"_erreur": message}
    except OSError as e:
        echec("N8N_INJOIGNABLE", str(e)[:200])


def chemins_webhook(doc):
    trouves = []
    for n in doc.get("nodes", []):
        if "webhook" in n.get("type", "").lower():
            chemin = (n.get("parameters", {}) or {}).get("path", "")
            if chemin:
                trouves.append(chemin)
    return trouves


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    publier = "--publier" in sys.argv
    chemin = Path(args[0]) if args else DEFAUT_FICHIER
    try:
        doc = json.loads(chemin.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        echec("FICHIER_ILLISIBLE", str(e)[:200])
    nom = doc.get("name", "")
    if not nom:
        echec("NOM_ABSENT", "le workflow n'a pas de nom.")
    miens = chemins_webhook(doc)
    if len(miens) != 1:
        echec("WEBHOOK_AMBIGU", "un seul trigger attendu, trouve : " + str(miens))

    env = {}
    for f in (RACINE / "n8n" / ".env", RACINE / ".env.local"):
        env.update({k: v for k, v in lire_env(f).items() if v})
    import os
    cle = os.environ.get("N8N_API_KEY", "") or env.get("N8N_API_KEY", "")
    base = (os.environ.get("N8N_BASE_URL", "") or env.get("N8N_BASE_URL", "")
            or "http://localhost:5678").rstrip("/")
    if not cle:
        echec("CLE_MANQUANTE", CREER_CLE)

    statut, liste = appel(base, cle, "GET", "/api/v1/workflows?limit=100")
    if statut == 401:
        echec("CLE_INVALIDE", "n8n refuse la cle (revendiquee ou expiree).")
    if statut != 200 or not isinstance(liste.get("data"), list):
        echec("LISTE_REFUSEE", str(liste.get("_erreur", statut))[:200])
    existants = liste["data"]
    cible = next((w for w in existants if w.get("name") == nom), None)

    # Doublon : un AUTRE workflow avec le meme webhook bloquerait la
    # publication (deux actifs = Telegram livre au hasard).
    for w in existants:
        if w.get("id") == (cible or {}).get("id"):
            continue
        statut_w, detail = appel(base, cle, "GET", "/api/v1/workflows/" + str(w["id"]))
        if statut_w != 200:
            continue
        if miens[0] in chemins_webhook(detail):
            echec("DOUBLON_WEBHOOK", "'" + miens[0] + "' deja utilise par « "
                  + str(w.get("name")) + " » : le desactiver d'abord.")

    if not publier:
        print("OK : cle valide, n8n joignable (" + base + ").")
        print("Prevu : " + ("mise a jour de « " + nom + " »." if cible
              else "creation de « " + nom + " ».") + " Relancer avec --publier.")
        return

    charge = {k: doc[k] for k in ("name", "nodes", "connections", "settings")
              if k in doc}
    if cible:
        statut, _ = appel(base, cle, "PUT",
                           "/api/v1/workflows/" + str(cible["id"]), charge)
        if statut != 200:
            echec("IMPORT_REFUSE", "mise a jour refusee (" + str(statut) + ").")
        wid = str(cible["id"])
        print("OK : « " + nom + " » mis a jour.")
    else:
        statut, cree = appel(base, cle, "POST", "/api/v1/workflows", charge)
        if statut not in (200, 201) or not cree.get("id"):
            echec("IMPORT_REFUSE", "creation refusee (" + str(statut) + ").")
        wid = str(cree["id"])
        print("OK : « " + nom + " » cree.")
    statut, _ = appel(base, cle, "POST", "/api/v1/workflows/" + wid + "/activate")
    if statut != 200:
        echec("ACTIVATION_REFUSEE", "workflow importe mais non actif.")
    statut, verif = appel(base, cle, "GET", "/api/v1/workflows/" + wid)
    if statut != 200 or verif.get("active") is not True:
        echec("ACTIVATION_REFUSEE", "l'activation n'a pas pris.")
    print("OK : « " + nom + " » publie et actif sur /webhook/" + miens[0] + ".")


if __name__ == "__main__":
    main()
