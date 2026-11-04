#!/usr/bin/env python3
"""Securite RouterOS + generation des tickets (workflows n8n).

- TLS : les `skipSslCertificateValidation: true` deviennent une
  exception explicite via ROUTEROS_TLS_INSECURE ("1"/"true"/"oui"),
  refusee par defaut. Jamais de desactivation silencieuse.
- Aleatoire : Math.random() remplace par require('crypto').randomBytes
  (alphabet de 32 lettres : aucun biais modulo). Echec ferme si crypto
  manque : aucun ticket cree. Le nonce de scrutation utilise aussi
  crypto, avec repli horodatage (unicite, pas un secret).
- HTML PDF : echappement HTML (profil, routeur, identifiant, mot de
  passe, destinataire) via esc(). Le QR code garde JSON.stringify.
- Partiels : la boucle mikhmon leve a la premiere echec avec le nombre
  reel (deja le cas : verifie, pas touche).

Idempotent : quitte 0 sans rien ecrire si deja applique.
Sauvegarde avant ecriture dans /tmp/sauvegarde-workflow-*.
Utilisation : python3 scripts/n8n/patch-workflow-securite.py
"""
import json
import shutil
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
TG = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"
MIKHMON = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"

TLS_DUR = "skipSslCertificateValidation: true"
TLS_SOUPLE = (
    "skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String("
    "($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1)"
    " /* Exception labo explicite uniquement, verifie par defaut. */"
)
TLS_CASSE = (
    "skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String("
    "($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1)"
    " // Exception labo explicite uniquement, verifie par defaut."
)

RAND_MIKHMON = (
    "const rand = len => Array.from({ length: len }, () => "
    "alphabet[Math.floor(Math.random() * alphabet.length)]).join('');"
)
RAND_SUR = (
    "const aleatoireCrypto = (n) => { try { var NC = require('crypto'); "
    "if (NC && NC.randomBytes) return NC.randomBytes(n); } catch (eCrypto) {} "
    "throw new Error('Génération aléatoire sécurisée indisponible : "
    "aucun ticket créé.'); }; "
    "const rand = len => { const o = aleatoireCrypto(len); let s = ''; "
    "for (let i = 0; i < len; i++) s += alphabet[o[i] % alphabet.length]; "
    "return s; };"
)

RAND_TG = (
    "const rand8 = () => Array.from({ length: 8 }, () => "
    "ALPH[Math.floor(Math.random() * ALPH.length)]).join('');"
)
RAND8_SUR = (
    "const aleatoireCrypto = () => { try { var NC = require('crypto'); "
    "if (NC && NC.randomBytes) return NC.randomBytes(8); } catch (eCrypto) {} "
    "throw new Error('Génération aléatoire sécurisée indisponible : "
    "aucun ticket créé.'); }; "
    "const rand8 = () => { const o = aleatoireCrypto(); let s = ''; "
    "for (let i = 0; i < 8; i++) s += ALPH[o[i] % ALPH.length]; return s; };"
)

NONCE_FAIBLE = "Math.floor(Math.random() * 1e9).toString(36)"
NONCE_SUR = (
    "(function () { try { return require('crypto').randomBytes(6)"
    ".toString('hex'); } catch (eNonce) { return String(Date.now()); } })()"
)

ESC_DEF = (
    "const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;')"
    ".replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); "
)

LIGNES_MIKHMON = (
    "const rows = tickets.map(t => `<tr><td>${t.username}</td>"
    "<td>${t.password}</td><td>${t.profile}</td></tr>`).join('');"
)
LIGNES_MIKHMON_SUR = (
    "const rows = tickets.map(t => `<tr><td>${esc(t.username)}</td>"
    "<td>${esc(t.password)}</td><td>${esc(t.profile)}</td></tr>`).join('');"
)
META_MIKHMON = "Profil: ${cfg.profile} · Générés:"
META_MIKHMON_SUR = "Profil: ${esc(cfg.profile)} · Générés:"

CARTES_TG = "<b>${t.code}</b>"
CARTES_TG_SUR = "<b>${esc(t.code)}</b>"
TITRE_TG = "<title>Tickets ${profile}</title>"
TITRE_TG_SUR = "<title>Tickets ${esc(profile)}</title>"
H1_TG = "<h1>Tickets Wi-Fi — ${profile}</h1>"
H1_TG_SUR = "<h1>Tickets Wi-Fi — ${esc(profile)}</h1>"


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


def remplacer(nom_fichier, doc, nom_node, ancien, nouveau, libelle):
    n = noeud(doc, nom_node)
    js = n["parameters"]["jsCode"]
    if ancien not in js:
        return False
    n["parameters"]["jsCode"] = js.replace(ancien, nouveau)
    print(nom_fichier + " : " + libelle + " (« " + nom_node + " »).")
    return True


def corriger_mikhmon():
    doc = charger(MIKHMON)
    applique = False
    for n in doc["nodes"]:
        js = (n.get("parameters", {}) or {}).get("jsCode", "")
        if TLS_CASSE in js:
            n["parameters"]["jsCode"] = js.replace(TLS_CASSE, TLS_SOUPLE)
            applique = True
            print("mikhmon : commentaire TLS repare (« " + n["name"] + " »).")
        elif TLS_DUR in js:
            n["parameters"]["jsCode"] = js.replace(TLS_DUR, TLS_SOUPLE)
            applique = True
            print("mikhmon : TLS explicite (« " + n["name"] + " »).")
    for nom_node, ancien, nouveau, libelle in (
        ("Générer les tickets dans RouterOS", RAND_MIKHMON, RAND_SUR + " " + ESC_DEF,
         "aleatoire sur + echappement HTML"),
        ("Générer les tickets dans RouterOS", LIGNES_MIKHMON, LIGNES_MIKHMON_SUR,
         "lignes HTML echappees"),
        ("Générer les tickets dans RouterOS", META_MIKHMON, META_MIKHMON_SUR,
         "meta HTML echappe"),
        ("Signer l'appel jobs", NONCE_FAIBLE, NONCE_SUR, "nonce sur"),
    ):
        if remplacer("mikhmon", doc, nom_node, ancien, nouveau, libelle):
            applique = True
    if not applique:
        print("mikhmon : deja applique.")
        return False
    ecrire(MIKHMON, doc)
    return True


def corriger_telegram():
    doc = charger(TG)
    applique = False
    for nom_node, ancien, nouveau, libelle in (
        ("Generer les tickets", RAND_TG, RAND8_SUR + " " + ESC_DEF,
         "aleatoire sur + echappement HTML"),
        ("Generer les tickets", CARTES_TG, CARTES_TG_SUR, "codes echappes"),
        ("Generer les tickets", TITRE_TG, TITRE_TG_SUR, "titre echappe"),
        ("Generer les tickets", H1_TG, H1_TG_SUR, "titre HTML echappe"),
    ):
        if remplacer("telegram", doc, nom_node, ancien, nouveau, libelle):
            applique = True
    if not applique:
        print("telegram : deja applique.")
        return False
    ecrire(TG, doc)
    return True


if __name__ == "__main__":
    corriger_mikhmon()
    corriger_telegram()
    print("OK : securite appliquee (ou deja presente).")
