#!/usr/bin/env python3
"""Patch multi-utilisateur pour workflow-mikhmon-patched.json.

Ajoute SANS reecrire le workflow :
  1. node « Vérifier la signature » (HMAC-SHA256 pure-JS, secret
     N8N_WEBHOOK_SECRET via $env) entre le webhook manuel et les
     paramètres. Exige tenantId. Le declencheur planifie interne
     reste direct (pas de surface exposee).
  2. « Paramètres Mikhmon » : recoit tenantId + cleIdempotence +
     callbackUrl, accepte les canaux interface et pdf.
  3. « Générer les tickets » : idempotence (ne recree rien si le
     commentaire traceur contient deja la cle), commentaire
     « tenant:… cle:… » visible dans Mikhmon.
  4. « Choisir le canal » : sorties Interface + PDF vers
     « Préparer le retour signé » + « Notifier l'application »
     (compte rendu HMAC vers /api/n8n/retour).

Rejouable : chaque ancrage est verifie avant ecriture.
Usage : python3 scripts/patch-workflow-multitenant.py
"""

import json
import shutil
import sys
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"
CRYPTO = Path(__file__).resolve().parent / "n8n-crypto.js"


def une_fois(texte: str, ancre: str, remplacement: str, etiquette: str) -> str:
    n = texte.count(ancre)
    if n != 1:
        sys.exit(f"ECHEC {etiquette} : ancre trouvee {n} fois (attendu 1).")
    return texte.replace(ancre, remplacement)


def main() -> None:
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    crypto = CRYPTO.read_text(encoding="utf-8").strip()
    noeuds = {n["name"]: n for n in donnees["nodes"]}

    for requis in ("Demande manuelle (Webhook)", "Paramètres Mikhmon",
                   "Générer les tickets dans RouterOS", "Choisir le canal",
                   "Rattacher la config au PDF"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")

    # --- 1. Paramètres Mikhmon : tenantId, cleIdempotence, callbackUrl ---
    params = noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"]
    params = une_fois(
        params,
        "if (!['telegram', 'whatsapp', 'printnode'].includes(deliveryChannel)) {",
        "if (!['telegram', 'whatsapp', 'printnode', 'interface', 'pdf'].includes(deliveryChannel)) {",
        "canaux",
    )
    params = une_fois(
        params,
        "'\" (telegram, whatsapp ou printnode).');",
        "'\" (telegram, whatsapp, printnode, interface ou pdf).');",
        "message canaux",
    )
    params = une_fois(
        params,
        "let routerBaseUrl = rawBase;",
        "let routerBaseUrl = rawBase;\n"
        "const tenantId = String(input.tenantId || env('TENANT_ID', 'defaut') || 'defaut').slice(0, 64);\n"
        "const cleIdempotence = String(input.cleIdempotence || '').slice(0, 128);",
        "identite",
    )
    params = une_fois(
        params,
        "  recipient: String(input.recipient || env('DELIVERY_RECIPIENT', '')),",
        "  recipient: String(input.recipient || env('DELIVERY_RECIPIENT', '')),\n"
        "  tenantId,\n"
        "  cleIdempotence: cleIdempotence,\n"
        "  callbackUrl: String(input.callbackUrl || ''),",
        "partage",
    )
    noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"] = params

    # --- 2. Générer : idempotence + commentaire traceur par tenant ---
    generer = noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"]
    generer = une_fois(
        generer,
        "const out = [];",
        "const out = [];\nconst clesVues = new Set();",
        "memoire cles",
    )
    generer = une_fois(
        generer,
        "for (const cfg of inputs) {\n"
        "  const auth = 'Basic ' + Buffer.from(cfg.routerUser + ':' + cfg.routerPassword).toString('base64');",
        "for (const cfg of inputs) {\n"
        "  const auth = 'Basic ' + Buffer.from(cfg.routerUser + ':' + cfg.routerPassword).toString('base64');\n"
        "  const cle = String(cfg.cleIdempotence || '');\n"
        "  const marqueur = cle ? ('cle:' + cle) : '';\n"
        "  // Idempotence : un appel rejoue avec la meme cle retrouve les\n"
        "  // tickets deja crees (commentaire traceur) et n'en recree aucun.\n"
        "  if (marqueur && !clesVues.has(marqueur)) {\n"
        "    let existants = [];\n"
        "    try {\n"
        "      const deja = await this.helpers.httpRequest({ method: 'GET', url: cfg.routerBaseUrl + '/rest/ip/hotspot/user', headers: { Authorization: auth, Accept: 'application/json' }, json: true, timeout: 30000, skipSslCertificateValidation: true });\n"
        "      existants = Array.isArray(deja) ? deja : (deja.data || deja.results || []);\n"
        "    } catch (e) {\n"
        "      throw new Error('Verification anti-doublon impossible : ' + (e.message || e));\n"
        "    }\n"
        "    if (existants.some(function (u) { return String((u && u.comment) || '').indexOf(marqueur) !== -1; })) {\n"
        "      out.push({ json: { ...cfg, tickets: [], generatedAt: new Date().toISOString(), html: '', generatedCount: 0, dejaGenere: true } });\n"
        "      clesVues.add(marqueur);\n"
        "      continue;\n"
        "    }\n"
        "  }\n"
        "  if (marqueur) clesVues.add(marqueur);",
        "controle doublon",
    )
    generer = une_fois(
        generer,
        "comment: 'n8n-mikhmon ' + new Date().toISOString()",
        "comment: 'n8n-mikhmon tenant:' + (cfg.tenantId || 'defaut') + ' cle:' + (cle || 'sans') + ' ' + new Date().toISOString()",
        "commentaire",
    )
    noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"] = generer

    # --- 3. Nouveau node : vérification HMAC du déclenchement ---
    verifier_code = (
        crypto + "\n"
        "// 1) tenantId obligatoire (isolement multi-utilisateur).\n"
        "// 2) signature HMAC-SHA256 du corps canonique, secret\n"
        "// N8N_WEBHOOK_SECRET declare dans l'environnement n8n.\n"
        "// Passe les elements inchanges si tout est bon.\n"
        "var secret = (typeof $env !== 'undefined' && $env && $env.N8N_WEBHOOK_SECRET) || '';\n"
        "if (!secret) throw new Error('N8N_WEBHOOK_SECRET manquant : declarez-le dans le docker-compose de n8n, puis activez ce workflow.');\n"
        "var elements = $input.all();\n"
        "for (var k = 0; k < elements.length; k++) {\n"
        "  var j = elements[k].json || {};\n"
        "  var corps = (j.body && typeof j.body === 'object') ? j.body : j;\n"
        "  var entetes = j.headers || {};\n"
        "  var recue = String(corps.signature || entetes['x-signature'] || '');\n"
        "  var tenant = String(corps.tenantId || '');\n"
        "  if (!tenant) throw new Error('tenantId obligatoire : appelez ce webhook via /api/tickets/lots.');\n"
        "  var charge = {};\n"
        "  Object.keys(corps).sort().forEach(function (cle) { if (cle !== 'signature') charge[cle] = corps[cle]; });\n"
        "  var attendue = hmacHex(secret, canon(charge));\n"
        "  if (!egaleConstant(recue, attendue)) throw new Error('Signature HMAC invalide : appel refuse.');\n"
        "}\n"
        "return elements;"
    )
    id_verifier = str(uuid.uuid4())
    donnees["nodes"].append({
        "parameters": {"jsCode": verifier_code},
        "id": id_verifier,
        "name": "Vérifier la signature",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [160, 200],
    })

    # --- 4. Nouveau node : retour signé vers l'application ---
    retour_code = (
        crypto + "\n"
        "// Compte rendu signe vers /api/n8n/retour : l'application verifie\n"
        "// la signature (N8N_CALLBACK_SECRET) et l'idempotence (cle).\n"
        "var secretRetour = (typeof $env !== 'undefined' && $env && $env.N8N_CALLBACK_SECRET) || '';\n"
        "if (!secretRetour) throw new Error('N8N_CALLBACK_SECRET manquant : declarez-le dans le docker-compose de n8n.');\n"
        "var sorties = [];\n"
        "var recus = $input.all();\n"
        "for (var r = 0; r < recus.length; r++) {\n"
        "  var cfg = recus[r].json || {};\n"
        "  if (!cfg.tenantId) throw new Error('tenantId manquant dans le retour.');\n"
        "  if (!cfg.cleIdempotence) throw new Error('cleIdempotence manquante dans le retour.');\n"
        "  if (!cfg.callbackUrl) throw new Error(\"callbackUrl manquante : l'appelant doit fournir callbackUrl (APP_URL + /api/n8n/retour).\");\n"
        "  var tix = Array.isArray(cfg.tickets) ? cfg.tickets : [];\n"
        "  var contenu = { tenantId: String(cfg.tenantId), cleIdempotence: String(cfg.cleIdempotence), statut: 'termine', quantiteCreee: tix.length };\n"
        "  var texte = canon(contenu);\n"
        "  sorties.push({ json: { callbackUrl: String(cfg.callbackUrl), corps: texte, signature: hmacHex(secretRetour, texte), tenantId: contenu.tenantId, cleIdempotence: contenu.cleIdempotence } });\n"
        "}\n"
        "return sorties;"
    )
    donnees["nodes"].append({
        "parameters": {"jsCode": retour_code},
        "id": str(uuid.uuid4()),
        "name": "Préparer le retour signé",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [2176, 320],
    })
    donnees["nodes"].append({
        "parameters": {
            "method": "POST",
            "url": "={{$json.callbackUrl}}",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{$json.corps}}",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "X-Signature", "value": "={{$json.signature}}"}
                ]
            },
            "options": {"timeout": 15000},
        },
        "id": str(uuid.uuid4()),
        "name": "Notifier l'application",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [2432, 320],
    })

    # --- 5. Connexions : webhook -> vérif -> paramètres ---
    connexions = donnees["connections"]
    manuel = connexions["Demande manuelle (Webhook)"]["main"][0]
    assert len(manuel) == 1 and manuel[0]["node"] == "Paramètres Mikhmon", \
        "Branchement manuel inattendu."
    connexions["Demande manuelle (Webhook)"]["main"][0] = [
        {"node": "Vérifier la signature", "type": "main", "index": 0}
    ]
    connexions["Vérifier la signature"] = {
        "main": [[{"node": "Paramètres Mikhmon", "type": "main", "index": 0}]]
    }

    # --- 6. Switch : sorties Interface + PDF vers le retour signé ---
    choix = noeuds["Choisir le canal"]["parameters"]["rules"]["values"]
    if len(choix) != 3:
        sys.exit("ECHEC : sorties du switch inattendues.")
    for canal, cle in (("interface", "Interface"), ("pdf", "PDF")):
        choix.append({
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "",
                            "typeValidation": "strict", "version": 2},
                "conditions": [{
                    "leftValue": "={{$json.deliveryChannel}}",
                    "rightValue": canal,
                    "operator": {"type": "string", "operation": "equals"},
                    "id": str(uuid.uuid4()),
                }],
                "combinator": "and",
            },
            "renameOutput": True,
            "outputKey": cle,
        })
    connexions["Choisir le canal"]["main"].append(
        [{"node": "Préparer le retour signé", "type": "main", "index": 0}])
    connexions["Choisir le canal"]["main"].append(
        [{"node": "Préparer le retour signé", "type": "main", "index": 0}])
    connexions["Préparer le retour signé"] = {
        "main": [[{"node": "Notifier l'application", "type": "main",
                   "index": 0}]]
    }

    # --- 7. Validation structurelle ---
    noms = [n["name"] for n in donnees["nodes"]]
    assert len(noms) == len(set(noms)), "Nom de node duplique."
    ids = [n["id"] for n in donnees["nodes"]]
    assert len(ids) == len(set(ids)), "Id duplique."
    for source, branches in connexions.items():
        assert source in noms, f"Connexion orpheline : {source}."
        for sortie in branches.get("main", []):
            for lien in sortie:
                assert lien["node"] in noms, \
                    f"Cible inconnue : {lien['node']}."

    shutil.copyfile(FICHIER, str(FICHIER) + ".bak")
    FICHIER.write_text(json.dumps(donnees, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    print("OK : workflow corrige (sauvegarde .bak).")
    print("Nodes ajoutes : Vérifier la signature, Préparer le retour signé, "
          "Notifier l'application.")


if __name__ == "__main__":
    main()
