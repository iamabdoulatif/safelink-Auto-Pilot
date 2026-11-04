#!/usr/bin/env python3
"""Branche SafeLink-Auto-Pilot au workflow « Mikhmon - génération
automatique de tickets Hotspot » SANS réécrire le workflow.

Ajoute : appel signé POST jobs, lecture signée GET configuration/:id,
acceptation du job, mode simulation, callback interne signé, callback
d'erreur, clôture des envois. Idempotent : quitte 0 si déjà appliqué.
Ne jamais lancer sans la sauvegarde /tmp/sauvegarde-workflow-*.
Utilisation : python3 scripts/n8n/patch-workflow-reappro.py
"""
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
CHEMIN = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"

SIGNER_JOBS = "Signer l'appel jobs"
RECUPERER_JOBS = "Récupérer les jobs signés"
FRACTIONNER = "Fractionner les jobs"
SIGNER_LECTURE = "Signer la lecture config"
LIRE_CONFIG = "Lire la configuration du job"
ACCEPTER_JOB = "Accepter le job"
MODE_SIMULATION = "Mode simulation ?"
ERREUR_SIGNEE = "Préparer l'erreur signée"
CLOTURER_ENVOI = "Clôturer l'envoi"

PARAMETRES = "Paramètres Mikhmon"
STOCK = "Lire le stock du profil"
SEUIL = "Stock inférieur au seuil ?"
GENERER = "Générer les tickets dans RouterOS"
AUCUN = "Aucun ticket à générer"
RETOUR = "Préparer le retour signé"
NOTIFIER = "Notifier l'application"
SCHEDULE = "Contrôle périodique (15 min)"
SWITCH = "Choisir le canal"


def charger():
    with open(CHEMIN, encoding="utf-8") as f:
        return json.load(f)


def noeud(doc, nom):
    for n in doc["nodes"]:
        if n["name"] == nom:
            return n
    raise SystemExit("Node introuvable : " + nom)


def type_version(doc, type_node):
    for n in doc["nodes"]:
        if n["type"] == type_node:
            return n["typeVersion"]
    raise SystemExit("Type inconnu : " + type_node)


def identifiants_uniques(doc):
    vus = set()
    for n in doc["nodes"]:
        if n["id"] in vus:
            raise SystemExit("Identifiant dupliqué : " + n["id"])
        vus.add(n["id"])


def nouveau(doc, nom, type_node, code_ou_params, position, est_code=True):
    import uuid

    params = {"jsCode": code_ou_params} if est_code else code_ou_params
    doc["nodes"].append(
        {
            "parameters": params,
            "id": str(uuid.uuid4()),
            "name": nom,
            "type": type_node,
            "typeVersion": type_version(doc, type_node),
            "position": position,
        }
    )


def branche(doc, source, cible, sortie=0):
    conns = doc["connections"].setdefault(source, {"main": []})
    while len(conns["main"]) <= sortie:
        conns["main"].append([])
    if not any(c["node"] == cible for c in conns["main"][sortie]):
        conns["main"][sortie].append({"node": cible, "type": "main",
                                      "index": 0})


def rebrancher(doc, source, ancien, nouveau_nom, sortie=0):
    conns = doc["connections"].get(source, {"main": []})["main"]
    if sortie < len(conns):
        conns[sortie] = [c for c in conns[sortie]
                         if c["node"] != ancien]
    branche(doc, source, nouveau_nom, sortie)


# -- Fragments JS embarqués (ES5, style des nodes existants) ---------------
# Les fonctions canon/hmacHex/sha256 sont EXTRAITES du node existant
# « Préparer le retour signé » : identité garantie avec web/lib/signature.ts.

def prefixe_helpers(doc):
    code = noeud(doc, RETOUR)["parameters"]["jsCode"]
    marqueur = "var secretRetour"
    if marqueur not in code:
        raise SystemExit("Marqueur de helpers introuvable.")
    prefixe = code.split(marqueur)[0]
    assert "function canon" in prefixe and "function hmacHex" in prefixe
    return prefixe


def js_secret_env():
    return (
        "var secretInterne = (($env && $env.N8N_CALLBACK_SECRET) || '');\n"
        "if (!secretInterne) throw new Error("
        "'N8N_CALLBACK_SECRET manquant : déclarez-le dans le docker-compose "
        "de n8n.');\n"
    )


def code_signer_jobs(prefixe):
    return (
        prefixe
        + js_secret_env()
        + "var appUrl = (($env && $env.APP_URL) || '').replace(/\\/$/, '');\n"
        + "if (!appUrl) throw new Error("
        "'APP_URL manquant : déclarez-le dans le docker-compose de n8n.');\n"
        + "var simulation = String(($env && $env.REAPPRO_SIMULATION) || '')"
        ".toLowerCase() === 'true';\n"
        + "// Le corps envoyé est la chaîne canonique exacte signée : le\n"
        + "// serveur vérifie le HMAC du corps BRUT reçu.\n"
        + "var texte = canon({ simulation: simulation });\n"
        + "var horodatage = String(Date.now());\n"
        + "var rafale = 'poll-' + horodatage + '-' + "
        "Math.floor(Math.random() * 1e9).toString(36);\n"
        + "return [{ json: { corps: texte, signature: hmacHex(secretInterne, "
        "texte), horodatage: horodatage, rafale: rafale, appUrl: appUrl } }];\n"
    )


def code_fractionner():
    return (
        "var entree = ($input.first() || {}).json || {};\n"
        "var donnees = entree.data || {};\n"
        "var jobs = Array.isArray(donnees.jobs) ? donnees.jobs : [];\n"
        "var appUrl = '';\n"
        'try { appUrl = ($("' + SIGNER_JOBS + '").first().json || {}).appUrl'
        ' || ""; } catch (e) { throw new Error("Rafale introuvable."); }\n'
        "// Aucun job : sortie vide = arrêt propre, sans erreur.\n"
        "return jobs.map(function (job) {\n"
        "  return { json: Object.assign({}, job, { appUrl: appUrl }) };\n"
        "});\n"
    )


def code_signer_lecture(prefixe):
    return (
        prefixe
        + js_secret_env()
        + "return $input.all().map(function (entree) {\n"
        + "  var job = entree.json || {};\n"
        + "  if (!job.runId) throw new Error('Job sans runId.');\n"
        + "  // GET sans corps : le serveur vérifie le HMAC de ''.\n"
        + "  return { json: Object.assign({}, job, { configSignature: "
        "hmacHex(secretInterne, ''), configHorodatage: String(Date.now()) })"
        " };\n"
        + "});\n"
    )


def code_accepter(prefixe):
    # L'acceptation part en POST /runs via les helpers (pas de node HTTP
    # intercalé) : la configuration traverse le node inchangée.
    return (
        prefixe
        + js_secret_env()
        + "var racineAccept = '';\n"
        + 'try { racineAccept = ($("' + SIGNER_JOBS + '").first().json'
        ' || {}).appUrl || ""; } catch (eRacine) {}\n'
        + "if (!racineAccept) throw new Error('Racine applicative "
        "introuvable.');\n"
        + "var passe = [];\n"
        + "for (var a = 0; a < $input.all().length; a++) {\n"
        + "  var reponseAccept = ($input.all()[a].json || {}).data || {};\n"
        + "  if (!reponseAccept.runId) throw new Error('Configuration sans "
        "runId.');\n"
        + "  var texteAccept = canon({ runId: String(reponseAccept.runId) });\n"
        + "  var horoAccept = String(Date.now());\n"
        + "  await this.helpers.httpRequest({\n"
        + "    method: 'POST',\n"
        + "    url: racineAccept + '/api/internal/n8n/runs',\n"
        + "    body: texteAccept,\n"
        + "    headers: { 'Content-Type': 'application/json', "
        "'X-Signature': hmacHex(secretInterne, texteAccept), "
        "'X-Timestamp': horoAccept, "
        "'X-Run-Id': String(reponseAccept.runId) },\n"
        + "    timeout: 15000,\n"
        + "  });\n"
        + "  passe.push({ json: $input.all()[a].json });\n"
        + "}\n"
        + "return passe;\n"
    )


def code_erreur():
    return (
        "return $input.all().map(function (entree) {\n"
        "  var cfg = entree.json || {};\n"
        "  if (!cfg.runId) throw new Error('Erreur sans runId : abandon.');\n"
        "  cfg.erreur = cfg.erreur || cfg.error || 'Échec pendant le "
        "traitement (voir l\\'exécution n8n).';\n"
        "  return { json: cfg };\n"
        "});\n"
    )


def code_cloturer():
    return (
        "// Les nodes d'envoi renvoient du HTTP : on reprend la config\n"
        "// complète (tickets créés, stock mesuré) pour le callback.\n"
        "var rattaches = [];\n"
        "try { rattaches = $('Rattacher la config au PDF').all(); }\n"
        "catch (e) { throw new Error('Récapitulatif introuvable.'); }\n"
        "if (!rattaches.length) throw new Error('Aucun récapitulatif.');\n"
        "return rattaches.map(function (it) { return { json: it.json }; });\n"
    )


# -- Adaptateur du flux jobs dans « Paramètres Mikhmon » --------------------
# Inséré après la première ligne (const input = ...). Noms préfixés job_
# pour ne jamais entrer en collision avec le code existant.

def adaptateur_job():
    return (
        "var reponseJob = input && input.data ? input.data : null;\n"
        "if (reponseJob && reponseJob.runId) {\n"
        "  var travailJob = {};\n"
        "  try {\n"
        "    var lusJob = $('" + SIGNER_LECTURE + "').all();\n"
        "    for (var kJob = 0; kJob < lusJob.length; kJob++) {\n"
        "      var candJob = (lusJob[kJob] && lusJob[kJob].json) || {};\n"
        "      if (String(candJob.runId) === String(reponseJob.runId)) "
        "{ travailJob = candJob; break; }\n"
        "    }\n"
        "  } catch (eJob) {}\n"
        "  var routeurJob = reponseJob.routeur || {};\n"
        "  var mikhmonJob = reponseJob.mikhmon || {};\n"
        "  var lotJob = reponseJob.lot || {};\n"
        "  var livraisonJob = reponseJob.livraison || {};\n"
        "  var tgJob = livraisonJob.telegram || {};\n"
        "  var waJob = livraisonJob.whatsapp || {};\n"
        "  var pnJob = livraisonJob.printnode || {};\n"
        "  var racineJob = String(travailJob.appUrl || '');\n"
        '  if (!racineJob) { try { racineJob = String(($("'
        + SIGNER_JOBS + '").first().json || {}).appUrl || ""); } '
        'catch (eRacine) {} }\n'
        "  if (!routeurJob.adresse || !routeurJob.motDePasseEcriture) "
        "throw new Error('Configuration routeur incomplète.');\n"
        "  input.routerBaseUrl = String(routeurJob.adresse).replace("
        "/\\/$/, '');\n"
        "  input.routerUser = routeurJob.utilisateurEcriture;\n"
        "  input.routerPassword = routeurJob.motDePasseEcriture;\n"
        "  input.hotspotServer = mikhmonJob.serveurHotspot || 'all';\n"
        "  input.profile = lotJob.profil;\n"
        "  input.quantity = lotJob.quantite;\n"
        "  input.threshold = lotJob.seuil;\n"
        "  var canalJob = String(livraisonJob.canal || 'telechargement');\n"
        "  input.deliveryChannel = canalJob === 'telechargement' ? 'pdf' "
        ": canalJob;\n"
        "  input.recipient = livraisonJob.destinataire || tgJob.chatId || "
        "waJob.destinataire || '';\n"
        "  input.tenantId = reponseJob.tenantId;\n"
        "  input.runId = reponseJob.runId;\n"
        "  input.cleIdempotence = reponseJob.runId;\n"
        "  input.simulation = reponseJob.simulation === true || "
        "travailJob.surveillance === true;\n"
        "  input.telegramBotToken = tgJob.jeton || '';\n"
        "  input.whatsappWebhookUrl = waJob.webhookUrl || '';\n"
        "  input.printNodeApiKey = pnJob.cle || '';\n"
        "  input.printNodePrinterId = pnJob.printerId || 0;\n"
        "  if (racineJob) input.callbackUrl = racineJob.replace(/\\/$/, '') "
        "+ '/api/internal/n8n/callback';\n"
        "}\n"
    )


# -- Nouveau corps de « Préparer le retour signé » --------------------------
# Flux automatique (runId présent) : charge interne { runId, tenantId,
# statut, quantiteCreee, stockAvant, stockApres[, erreur] }, HMAC du corps
# brut + horodatage + runId. Flux manuel historique : bloc d'origine,
# repris à l'identique (indentation seule).

def nouveau_retour(doc, prefixe):
    code = noeud(doc, RETOUR)["parameters"]["jsCode"]
    tail = code.split("var secretRetour", 1)[1]
    pivot = "for (var r = 0; r < recus.length; r++) {"
    if pivot not in tail:
        raise SystemExit("Boucle du retour introuvable.")
    corps_ancien = tail.split(pivot, 1)[1].rsplit("return sorties;", 1)[0]
    if corps_ancien.rstrip().endswith("}"):
        corps_ancien = corps_ancien.rstrip()[: -1]
    legacy = "".join("    " + l + "\n" if l.strip() else "\n"
                     for l in corps_ancien.splitlines())
    neuf = (
        "var sorties = [];\n"
        "var recus = $input.all();\n"
        "for (var r = 0; r < recus.length; r++) {\n"
        "  var cfg = recus[r].json || {};\n"
        "  if (cfg.runId) {\n"
        "    if (!cfg.tenantId) throw new Error('tenantId manquant.');\n"
        "    if (!cfg.callbackUrl) throw new Error('callbackUrl manquante "
        "(flux automatique).');\n"
        "    var tixAuto = Array.isArray(cfg.tickets) ? cfg.tickets : [];\n"
        "    var errAuto = cfg.erreur || cfg.error || null;\n"
        "    var stockAv = (cfg.stockAvant !== undefined && "
        "cfg.stockAvant !== null) ? cfg.stockAvant : "
        "(cfg.stockAvailable !== undefined ? cfg.stockAvailable : null);\n"
        "    var stockAp = (cfg.stockApres !== undefined && "
        "cfg.stockApres !== null) ? cfg.stockApres : "
        "(cfg.stockAvailable !== undefined ? cfg.stockAvailable : null);\n"
        "    var contenuAuto = { runId: String(cfg.runId), tenantId: "
        "String(cfg.tenantId), statut: errAuto ? 'echoue' : 'termine', "
        "quantiteCreee: tixAuto.length, stockAvant: stockAv, "
        "stockApres: stockAp };\n"
        "    if (errAuto) contenuAuto.erreur = String(errAuto).slice(0, 500);\n"
        "    var texteAuto = canon(contenuAuto);\n"
        "    var horoAuto = String(Date.now());\n"
        "    sorties.push({ json: { callbackUrl: String(cfg.callbackUrl), "
        "corps: texteAuto, signature: hmacHex(secretRetour, texteAuto), "
        "horodatage: horoAuto, runId: contenuAuto.runId, "
        "tenantId: contenuAuto.tenantId, "
        "cleIdempotence: contenuAuto.runId } });\n"
        "  } else {\n"
        + legacy
        + "  }\n"
        "}\n"
        "return sorties;\n"
    )
    # Declarations d'origine (secret, gardes) jusqu'a « var sorties ».
    declarations = tail.split("var sorties", 1)[0]
    return prefixe + "var secretRetour" + declarations + neuf


# -- Nodes HTTP --------------------------------------------------------------

def params_http_jobs():
    return {
        "method": "POST",
        "url": "={{$json.appUrl}}/api/internal/n8n/replenishment/jobs",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{$json.corps}}",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "X-Signature", "value": "={{$json.signature}}"},
                {"name": "X-Timestamp", "value": "={{$json.horodatage}}"},
                {"name": "X-Run-Id", "value": "={{$json.rafale}}"},
            ]
        },
        "options": {"timeout": 15000},
    }


def params_http_lecture():
    return {
        "method": "GET",
        "url": "={{$json.appUrl}}/api/internal/n8n/configurations/"
               "{{$json.runId}}",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "X-Signature",
                 "value": "={{$json.configSignature}}"},
                {"name": "X-Timestamp",
                 "value": "={{$json.configHorodatage}}"},
                {"name": "X-Run-Id", "value": "={{$json.runId}}"},
            ]
        },
        "options": {"timeout": 15000},
    }


def params_si_simulation():
    return {
        "conditions": {
            "boolean": [
                {
                    "value1": "={{$json.simulation}}",
                    "operation": "isTrue",
                }
            ],
            "combinator": "and",
            "options": {
                "caseSensitive": True,
                "leftValue": "",
                "typeValidation": "strict",
                "version": 1,
            },
        },
        "options": {},
    }


# -- Application ---------------------------------------------------------------

def appliquer(doc):
    prefixe = prefixe_helpers(doc)

    # 1) Nouveaux nodes du flux jobs (positions en escalier sous le flux).
    nouveau(doc, SIGNER_JOBS, "n8n-nodes-base.code",
            code_signer_jobs(prefixe), [16, 560])
    nouveau(doc, RECUPERER_JOBS, "n8n-nodes-base.httpRequest",
            params_http_jobs(), [208, 560], est_code=False)
    nouveau(doc, FRACTIONNER, "n8n-nodes-base.code",
            code_fractionner(), [400, 560])
    nouveau(doc, SIGNER_LECTURE, "n8n-nodes-base.code",
            code_signer_lecture(prefixe), [592, 560])
    nouveau(doc, LIRE_CONFIG, "n8n-nodes-base.httpRequest",
            params_http_lecture(), [784, 560], est_code=False)
    nouveau(doc, ACCEPTER_JOB, "n8n-nodes-base.code",
            code_accepter(prefixe), [784, 720])
    # 2) Simulation, erreur, cloture.
    nouveau(doc, MODE_SIMULATION, "n8n-nodes-base.if",
            params_si_simulation(), [984, 272], est_code=False)
    nouveau(doc, ERREUR_SIGNEE, "n8n-nodes-base.code",
            code_erreur(), [1408, 400])
    nouveau(doc, CLOTURER_ENVOI, "n8n-nodes-base.code",
            code_cloturer(), [2176, 160])

    # 3) Adaptateur jobs dans « Paramètres Mikhmon » (apres la 1re ligne).
    params = noeud(doc, PARAMETRES)["parameters"]
    lignes = params["jsCode"].splitlines(keepends=True)
    assert lignes[0].startswith("const input = $json.body ?? $json;")
    params["jsCode"] = lignes[0] + adaptateur_job() + "".join(lignes[1:])
    # « telechargement » est converti en « pdf » par l'adaptateur : la liste
    # des canaux reste inchangée, la sortie PDF mène seule au callback.

    # 4) Callback interne dans « Préparer le retour signé ».
    noeud(doc, RETOUR)["parameters"]["jsCode"] = nouveau_retour(doc,
                                                                 prefixe)

    # 5) Horodatage + runId vers le callback.
    notifier = noeud(doc, NOTIFIER)["parameters"]["headerParameters"][
        "parameters"]
    notifier.append({"name": "X-Timestamp",
                     "value": "={{$json.horodatage}}"})
    notifier.append({"name": "X-Run-Id", "value": "={{$json.runId}}"})

    # 6) Erreurs => callback d'erreur (arrêt propre, run clôturé en échec).
    for nom in (GENERER, STOCK):
        noeud(doc, nom)["parameters"]["onError"] = "continueErrorOutput"
        branche(doc, nom, ERREUR_SIGNEE, sortie=1)
    branche(doc, ERREUR_SIGNEE, RETOUR)

    # 7) Câblage du flux jobs.
    rebrancher(doc, SCHEDULE, PARAMETRES, SIGNER_JOBS)
    branche(doc, SIGNER_JOBS, RECUPERER_JOBS)
    branche(doc, RECUPERER_JOBS, FRACTIONNER)
    branche(doc, FRACTIONNER, SIGNER_LECTURE)
    branche(doc, SIGNER_LECTURE, LIRE_CONFIG)
    branche(doc, LIRE_CONFIG, ACCEPTER_JOB)
    branche(doc, ACCEPTER_JOB, PARAMETRES)
    # « Accepter le job » notifie POST /runs lui-même (helpers) puis
    # transmet la configuration inchangée vers « Paramètres Mikhmon ».

    # 8) Simulation : stock bas + simulation => callback direct, sans
    # création ni envoi. Stock suffisant => callback de clôture.
    rebrancher(doc, SEUIL, GENERER, MODE_SIMULATION)
    branche(doc, MODE_SIMULATION, RETOUR, sortie=0)
    branche(doc, MODE_SIMULATION, GENERER, sortie=1)
    branche(doc, AUCUN, RETOUR)

    # 9) Envois => clôture => callback (le PDF reste joint au récapitulatif).
    for expediteur in ("Envoyer PDF Telegram",
                       "Envoyer PDF WhatsApp (adaptateur)",
                       "Imprimer via PrintNode"):
        branche(doc, expediteur, CLOTURER_ENVOI)
    branche(doc, CLOTURER_ENVOI, RETOUR)

    # 10) Sécurité : désactivé tant qu'aucune configuration valide.
    doc["active"] = False
    doc["description"] = (
        "AUTO DÉSACTIVÉ : réactiver après configuration valide (routeur "
        "testé, profil validé, canal testé, simulation réussie). Flux jobs "
        "SafeLink : Schedule 15 min → jobs signés → config signée → stock "
        "→ seuil → simulation ? → génération limitée → PDF Gotenberg → "
        "canal → callback interne signé. Tickets créés sur RouterOS "
        "(/ip/hotspot/user), visibles dans Mikhmon. Simulation : lecture "
        "seule, aucun ticket, aucun envoi."
    )


def valider(doc):
    identifiants_uniques(doc)
    noms = {n["name"] for n in doc["nodes"]}
    for source, conns in doc["connections"].items():
        if source not in noms:
            raise SystemExit("Connexion orpheline : " + source)
        for sorties in conns.get("main", []):
            for cible in sorties:
                if cible["node"] not in noms:
                    raise SystemExit("Cible inconnue : " + cible["node"])
    for nom in (SIGNER_JOBS, RECUPERER_JOBS, FRACTIONNER, SIGNER_LECTURE,
                LIRE_CONFIG, ACCEPTER_JOB, MODE_SIMULATION, ERREUR_SIGNEE,
                CLOTURER_ENVOI):
        if nom not in noms:
            raise SystemExit("Node manquant après patch : " + nom)


def main():
    doc = charger()
    noms = {n["name"] for n in doc["nodes"]}
    if SIGNER_JOBS in noms:
        print("Patch déjà appliqué.")
        return
    for prerequis in (SCHEDULE, PARAMETRES, STOCK, SEUIL, GENERER, AUCUN,
                      RETOUR, NOTIFIER):
        if prerequis not in noms:
            raise SystemExit("Prérequis manquant : " + prerequis)
    appliquer(doc)
    valider(doc)
    with open(CHEMIN, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Patch appliqué : " + str(len(doc["nodes"])) + " nodes.")


if __name__ == "__main__":
    main()
