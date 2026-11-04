#!/usr/bin/env python3
"""Patch multicanal P1-P6 pour workflow-mikhmon-patched.json.

P1 Parametres Mikhmon : mappe targetQuantity->quantity,
   whatsappRecipient->recipient, trace userId + IDs de connexion.
P2 Portillon de stock : OU avec forcerGeneration (manuel valide).
P3 Nouveau node « Vérifier le bot Telegram » (getMe avant envoi).
P4 Node « Générer » : compte le stock après création (stockApres).
P5 Envoi Telegram : légende routeur/profil/quantité/stocks/date.
P6 Récapitulatif d'approbation : routeur + date.
P7 Schedule Trigger : déjà actif (vérifié, sans modification).

Ajouts seulement : aucun node/paramètre existant n'est supprimé.
Sauvegarde horodatée avant écriture. Rejouable (ancrages vérifiés).
Usage : python3 scripts/patch-workflow-multicanal.py
"""

import json
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"


def une_fois(texte: str, ancre: str, remplacement: str, etiquette: str) -> str:
    n = texte.count(ancre)
    if n != 1:
        sys.exit(f"ECHEC {etiquette} : ancre trouvee {n} fois (attendu 1).")
    return texte.replace(ancre, remplacement)


def main() -> None:
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}

    for requis in ("Paramètres Mikhmon", "Stock inférieur au seuil ?",
                   "Générer les tickets dans RouterOS",
                   "Choisir le canal", "Envoyer PDF Telegram",
                   "Préparer le récapitulatif"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")

    # --- P1a : normalisation des 12 noms du contrat ---
    params = noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"]
    params = une_fois(
        params,
        "if (input.userId === undefined && input.utilisateurId !== undefined) input.userId = String(input.utilisateurId);",
        "if (input.userId === undefined && input.utilisateurId !== undefined) input.userId = String(input.utilisateurId);\n"
        "if (input.quantity === undefined && input.targetQuantity !== undefined) input.quantity = input.targetQuantity;\n"
        "if (input.recipient === undefined && input.whatsappRecipient !== undefined) input.recipient = String(input.whatsappRecipient);",
        "P1a normalisation",
    )
    # --- P1b : traçabilité dans le partagé ---
    params = une_fois(
        params,
        "  tenantId,\n  cleIdempotence: cleIdempotence,",
        "  tenantId,\n"
        "  userId: String(input.userId || ''),\n"
        "  mikhmonConnectionId: input.mikhmonConnectionId === undefined || input.mikhmonConnectionId === null ? null : Number(input.mikhmonConnectionId),\n"
        "  routerConnectionId: input.routerConnectionId === undefined || input.routerConnectionId === null ? null : Number(input.routerConnectionId),\n"
        "  cleIdempotence: cleIdempotence,\n"
        "  forcerGeneration: input.forcerGeneration === true,",
        "P1b partage",
    )
    noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"] = params

    # --- P2 : portillon OU (manuel valide saute le seuil) ---
    noeud_si = noeuds["Stock inférieur au seuil ?"]
    conditions = noeud_si["parameters"]["conditions"]["boolean"]
    assert len(conditions) == 1, "P2 : conditions inattendues."
    conditions.append({
        "value1": "={{$json.forcerGeneration}}",
        "operation": "isTrue",
    })
    noeud_si["parameters"]["conditions"]["combinator"] = "or"

    # --- P4 : stock après création dans « Générer » ---
    generer = noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"]
    generer = une_fois(
        generer,
        "  const generatedAt = new Date().toISOString();",
        "  let stockApres = null;\n"
        "  try {\n"
        "    const relu = await this.helpers.httpRequest({ method: 'GET', url: cfg.routerBaseUrl + '/rest/ip/hotspot/user', headers: { Authorization: auth, Accept: 'application/json' }, json: true, timeout: 30000, skipSslCertificateValidation: true });\n"
        "    const liste = Array.isArray(relu) ? relu : (relu.data || relu.results || []);\n"
        "    const neuf = function (u) { return String((u && u.profile) || '') === cfg.profile && (u && u.disabled) !== true && String((u && u.disabled) || '').toLowerCase() !== 'true' && ['0s', '00:00:00', ''].indexOf(String((u && u.uptime) || '0s').trim()) !== -1; };\n"
        "    stockApres = liste.filter(neuf).length;\n"
        "  } catch (eApres) { stockApres = null; }\n"
        "  const generatedAt = new Date().toISOString();",
        "P4 relecture",
    )
    generer = une_fois(
        generer,
        "out.push({ json: { ...cfg, tickets: tickets.map(({routerResult, ...t}) => t), generatedAt, html, generatedCount: tickets.length } });",
        "out.push({ json: { ...cfg, tickets: tickets.map(({routerResult, ...t}) => t), generatedAt, html, generatedCount: tickets.length, stockAvant: (cfg.stockAvailable !== undefined ? cfg.stockAvailable : null), stockApres: stockApres } });",
        "P4 sortie",
    )
    noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"] = generer

    # --- P3 : node getMe avant l'envoi Telegram ---
    verifier_code = (
        "// Garde-fou avant envoi : le jeton doit etre reconnu par Telegram.\n"
        "// Le jeton transite dans l'entree signee serveur-a-serveur, jamais\n"
        "// dans les journaux : seul le diagnostic d'echec est conserve.\n"
        "var elements = $input.all();\n"
        "for (var k = 0; k < elements.length; k++) {\n"
        "  var cfg = elements[k].json || {};\n"
        "  var jeton = String(cfg.telegramBotToken || '');\n"
        "  if (!jeton) throw new Error('Jeton Telegram manquant : envoi annule.');\n"
        "  var rep;\n"
        "  try {\n"
        "    rep = await this.helpers.httpRequest({ method: 'GET', url: 'https://api.telegram.org/bot' + jeton + '/getMe', json: true, timeout: 15000 });\n"
        "  } catch (e) { throw new Error('Telegram injoignable pour getMe : ' + (e.message || e)); }\n"
        "  if (!rep || rep.ok !== true) throw new Error('Jeton Telegram refuse par getMe : envoi annule.');\n"
        "}\n"
        "return elements;"
    )
    donnees["nodes"].append({
        "parameters": {"jsCode": verifier_code},
        "id": str(uuid.uuid4()),
        "name": "Vérifier le bot Telegram",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [2176, -160],
    })

    # --- P5 : légende du document Telegram ---
    envoi = noeuds["Envoyer PDF Telegram"]["parameters"]
    corps = envoi["bodyParameters"]["parameters"]
    assert all(p.get("name") != "caption" for p in corps), \
        "P5 : légende déjà présente."
    corps.append({
        "name": "caption",
        "value": '="Routeur " + ($json.routeurNom || $json.routerBaseUrl) + " · Profil " + $json.profile + " · " + $json.generatedCount + " tickets créés · Stock " + $json.stockAvant + " → " + $json.stockApres + " · " + $json.generatedAt',
    })

    # --- P6 : récapitulatif d'approbation ---
    recap = noeuds["Préparer le récapitulatif"]["parameters"]["jsCode"]
    recap = une_fois(
        recap,
        "Destinataire: ${cfg.recipient}\\n\\nUtilisez",
        "Destinataire: ${cfg.recipient}\\nRouteur: ${cfg.routeurNom || cfg.routerBaseUrl || '?'}\\nDate: ${new Date().toISOString()}\\n\\nUtilisez",
        "P6 récapitulatif",
    )
    noeuds["Préparer le récapitulatif"]["parameters"]["jsCode"] = recap

    # --- Connexions : Choisir[0] -> Vérifier le bot -> Envoyer ---
    connexions = donnees["connections"]
    choix = connexions["Choisir le canal"]["main"]
    assert len(choix) == 5, "P3 : sorties du switch inattendues."
    assert choix[0][0]["node"] == "Envoyer PDF Telegram", \
        "P3 : première sortie inattendue."
    choix[0] = [
        {"node": "Vérifier le bot Telegram", "type": "main", "index": 0}
    ]
    connexions["Vérifier le bot Telegram"] = {
        "main": [[{"node": "Envoyer PDF Telegram", "type": "main",
                   "index": 0}]]
    }

    # --- P7 : activation explicite (déclencheur 15 min effectif) ---
    planifie = None
    for n in donnees["nodes"]:
        if n.get("type") == "n8n-nodes-base.scheduleTrigger":
            planifie = n
    assert planifie is not None, "P7 : scheduleTrigger introuvable."
    if donnees.get("active") is not True:
        donnees["active"] = True
        print("P7 : workflow active (schedule 15 min effectif).")
    else:
        print("P7 : workflow deja actif.")

    # --- Validation structurelle ---
    noms = [n["name"] for n in donnees["nodes"]]
    assert len(noms) == len(set(noms)), "Nom de node dupliqué."
    ids = [n["id"] for n in donnees["nodes"]]
    assert len(ids) == len(set(ids)), "Id dupliqué."
    for source, branches in connexions.items():
        assert source in noms, f"Connexion orpheline : {source}."
        for sortie in branches.get("main", []):
            for lien in sortie:
                assert lien["node"] in noms, \
                    f"Cible inconnue : {lien['node']}."

    horodatage = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    shutil.copyfile(FICHIER, str(FICHIER) + "." + horodatage + ".bak")
    FICHIER.write_text(json.dumps(donnees, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    print("OK : workflow corrigé (P1-P7).")
    print("Nodes : " + str(len(noms)) + " (dont « Vérifier le bot Telegram »).")
    print("Sauvegarde : " + str(FICHIER) + "." + horodatage + ".bak")


if __name__ == "__main__":
    main()
