#!/usr/bin/env python3
"""Verifie la liaison Telegram -> n8n -> SafeLink. Lecture seule :
aucun ticket, aucun appel routeur, aucun setWebhook.

Controles :
 1. bot configure (getMe, jeton jamais affiche) ;
 2. getWebhookInfo : URL, erreurs, dernier message, attente ;
 3. URL = webhook de production n8n (pas de /webhook-test) ;
 4. un seul workflow possede le trigger (exports du depot) ;
 5. export Telegram actif ;
 6. Mikhmon n'intercepte rien ;
 7. variables n8n presentes (n8n/.env) ;
 8. memes secrets cote SafeLink (comparaison par hash, jamais affiches) ;
 9. SafeLink joignable.
Erreurs lisibles : SECRET_MANQUANT, BOT_NON_CONFIGURE, WEBHOOK_INCORRECT,
WORKFLOW_INACTIF, SAFELINK_INACCESSIBLE.
Utilisation : python3 scripts/n8n/verifier-liaison-telegram.py
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
erreurs = []


def signaler(code, message):
    erreurs.append(code)
    print("ECHEC [" + code + "] : " + message)


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


def api_telegram(jeton, methode):
    derniere = None
    for _ in range(2):
        try:
            with urllib.request.urlopen(
                "https://api.telegram.org/bot" + jeton + "/" + methode,
                timeout=20,
            ) as reponse:
                return json.load(reponse)
        except Exception as e:
            derniere = e
    signaler("TELEGRAM_INJOIGNABLE", "api.telegram.org injoignable : " + str(derniere)[:120])
    return None


# --- 1) bot configure (getMe, jeton masque) ---
web_env = lire_env(RACINE / "web" / ".env.local")
racine_env = lire_env(RACINE / ".env.local")
jeton = web_env.get("TELEGRAM_BOT_TOKEN", "") or racine_env.get("TELEGRAM_BOT_TOKEN", "")
if not jeton:
    signaler("BOT_NON_CONFIGURE", "TELEGRAM_BOT_TOKEN absent de web/.env.local et .env.local.")
    print("Info : jeton BotFather a renseigner des deux cotes (meme valeur).")
    sys.exit(1)
moi = api_telegram(jeton, "getMe")
if moi and moi.get("ok"):
    print("OK : bot @" + moi["result"].get("username", "?") + " (jeton masque).")
elif moi:
    signaler("BOT_NON_CONFIGURE", "getMe refuse : jeton invalide ou revoque.")

# --- 2) getWebhookInfo ---
info = api_telegram(jeton, "getWebhookInfo")
if info and info.get("ok"):
    w = info["result"]
    print("Webhook : " + (w.get("url") or "(aucun)"))
    print("Erreurs : " + str(w.get("pending_update_count", 0)) + " en attente.")
    if w.get("last_error_message"):
        print("Derniere erreur : " + str(w["last_error_message"])[:200])
    url = w.get("url", "")
    # --- 3) production uniquement ---
    if "/webhook-test" in url:
        signaler("WEBHOOK_INCORRECT", "URL de TEST utilisee en exploitation.")
    if not url or "localhost" in url or "127.0.0.1" in url:
        signaler("WEBHOOK_INCORRECT", "URL injoignable depuis Telegram (localhost).")
    if "ngrok" in url:
        print("Alerte : tunnel ephemere (meurt au redemarrage, URL changeante).")
    if w.get("pending_update_count", 0) and "Not Found" in str(w.get("last_error_message", "")):
        signaler("WORKFLOW_INACTIF", "Telegram recoit 404 : tunnel mort ou workflow inactif dans n8n.")

# --- 4) un seul trigger (exports) ---
triggers = []
for f in ("workflow-telegram-tickets.json", "workflow-mikhmon-patched.json"):
    try:
        doc = json.load(open(RACINE / "n8n" / "workflows" / f, encoding="utf-8"))
    except (OSError, ValueError) as e:
        signaler("EXPORT_ILLISIBLE", f + " : " + str(e)[:120])
        continue
    for n in doc.get("nodes", []):
        if "webhook" in n.get("type", "").lower():
            triggers.append(f + " :: " + n["name"] + " :: " + str((n.get("parameters", {}) or {}).get("path", "")))
    if f == "workflow-telegram-tickets.json" and doc.get("active") is not True:
        signaler("WORKFLOW_INACTIF", "export Telegram avec active=false.")
telegram_triggers = [t for t in triggers if "tg-safelink" in t]
print("Triggers webhook (exports) :")
for t in triggers:
    print("  - " + t)
if len(telegram_triggers) != 1:
    signaler("DOUBLON_WEBHOOK", "plusieurs triggers Telegram dans les exports.")
# --- 6) Mikhmon n'intercepte pas Telegram ---
try:
    doc = json.load(open(RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json", encoding="utf-8"))
    if any("telegram" in n.get("type", "").lower() and "trigger" in n.get("type", "").lower() for n in doc.get("nodes", [])):
        signaler("INTERCEPTION", "le workflow Mikhmon possede un trigger Telegram.")
    else:
        print("OK : Mikhmon sans trigger Telegram.")
except (OSError, ValueError):
    pass

# --- 7+8) variables n8n et parite SafeLink (hash, jamais affiche) ---
n8n_env = lire_env(RACINE / "n8n" / ".env")
for cle in ("APP_URL", "N8N_WEBHOOK_SECRET", "N8N_CALLBACK_SECRET", "TELEGRAM_BOT_TOKEN"):
    if not n8n_env.get(cle):
        signaler("SECRET_MANQUANT", cle + " absent de n8n/.env (lu par n8n).")
for cle in ("N8N_WEBHOOK_SECRET", "N8N_CALLBACK_SECRET", "TELEGRAM_BOT_TOKEN"):
    a = web_env.get(cle, "")
    b = n8n_env.get(cle, "")
    if a and b:
        ha = hashlib.sha256(a.encode()).hexdigest()[:12]
        hb = hashlib.sha256(b.encode()).hexdigest()[:12]
        if ha == hb:
            print("OK : " + cle + " identique des deux cotes (hash compare).")
        else:
            signaler("SECRET_DIVERGENT", cle + " differe entre web/.env.local et n8n/.env.")

# --- 9) SafeLink joignable ---
app_url = (web_env.get("APP_URL", "") or "http://localhost:3000").rstrip("/")
try:
    with urllib.request.urlopen(app_url + "/api/telegram/contexte", data=b"{}", timeout=10) as r:
        print("OK : SafeLink repond (" + str(r.status) + " sur /api/telegram/contexte).")
except Exception as e:
    signaler("SAFELINK_INACCESSIBLE", app_url + " injoignable : " + str(e)[:120])

if erreurs:
    print(str(len(set(erreurs))) + " famille(s) d'erreur : " + ", ".join(sorted(set(erreurs))) + ".")
    sys.exit(1)
print("OK : liaison Telegram -> n8n -> SafeLink coherente.")
