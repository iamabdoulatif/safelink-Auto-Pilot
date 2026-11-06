#!/usr/bin/env python3
"""Portillon d'approbation humaine sur le flux AUTOMATIQUE (jobs SaaS).

Si la règle du dashboard demande une approbation, le workflow envoie
« Vous allez assister à une génération de X tickets pour PROFIL.
Vous consentez ? » sur Telegram (boutons) ou WhatsApp (liens), attend
la réponse (node Wait), puis génère seulement si la réponse est oui.
Sans approbation demandée, le flux est inchangé.

Le même message sert la demande manuelle avec approbation.

Ajouts seulement, ancrages vérifiés, sauvegarde horodatée.
Usage : python3 scripts/n8n/patch-workflow-approbation-auto.py
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


MESSAGE = (
    "🔐 DEMANDE D'APPROBATION\\n\\n"
    "Vous allez assister à une génération de ${cfg.quantity} tickets "
    "pour ${cfg.profile}.\\n"
    "Stock actuel : ${cfg.stockAvailable} · Seuil : ${cfg.threshold}\\n"
    "Routeur : ${cfg.routeurNom || cfg.routerBaseUrl || '?'}\\n\\n"
    "Vous consentez à cette génération ?"
)

PREPARER = r"""return $input.all().map(function (entree) {
  var cfg = entree.json || {};
  var approvalUrl = $execution.resumeUrl;
  var message = '🔐 DEMANDE D\'APPROBATION\n\n'
    + 'Vous allez assister à une génération de ' + cfg.quantity
    + ' tickets pour ' + cfg.profile + '.\n'
    + 'Stock actuel : ' + cfg.stockAvailable + ' · Seuil : ' + cfg.threshold + '\n'
    + 'Routeur : ' + (cfg.routeurNom || cfg.routerBaseUrl || '?') + '\n\n'
    + 'Vous consentez à cette génération ?';
  var copie = {};
  for (var k in cfg) copie[k] = cfg[k];
  copie.approvalUrl = approvalUrl;
  copie.approveUrl = approvalUrl + '?approved=true';
  copie.rejectUrl = approvalUrl + '?approved=false';
  copie.approvalMessage = message;
  return { json: copie };
});
"""

ENVOYER = r"""// Envoie la demande d'approbation sur le canal choisi dans le
// dashboard. Telegram : boutons. WhatsApp : message avec les liens
// (l'adaptateur ne sait pas faire de boutons). Un échec d'envoi
// interrompt le run (sortie erreur), jamais de génération silencieuse.
const sorties = [];
for (const item of $input.all()) {
  const cfg = item.json || {};
  const canal = String(cfg.approbationCanal || 'telegram');
  const destinataire = String(cfg.approbationDestinataire || cfg.recipient || '');
  if (!destinataire) throw new Error('Destinataire d\'approbation manquant pour le canal ' + canal + '.');
  if (canal === 'whatsapp') {
    const url = String(cfg.whatsappWebhookUrl || '');
    if (!url) throw new Error('Adaptateur WhatsApp non configuré : approbation impossible.');
    const texte = cfg.approvalMessage + '\n\n✅ Approuver : ' + cfg.approveUrl + '\n❌ Refuser : ' + cfg.rejectUrl;
    await this.helpers.httpRequest({ method: 'POST', url, body: { to: destinataire, text: texte, message: texte }, json: true, timeout: 30000 });
  } else {
    const jeton = String(cfg.telegramBotToken || '');
    if (!jeton) throw new Error('Jeton Telegram manquant : approbation impossible.');
    await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendMessage', body: { chat_id: destinataire, text: cfg.approvalMessage, reply_markup: { inline_keyboard: [[{ text: '✅ Approuver', url: cfg.approveUrl }, { text: '❌ Refuser', url: cfg.rejectUrl }]] } }, json: true, timeout: 30000 });
  }
  sorties.push({ json: { ...cfg, approbationEnvoyee: canal } });
}
return sorties;
"""

VALIDER = r"""return $input.all().map(i => {
  const approval = i.json.query ?? i.json.body ?? i.json;
  const approved = approval.approved === true || String(approval.approved).toLowerCase() === 'true' || String(approval.action).toLowerCase() === 'approve';
  return { json: { ...i.json, approved, approvalDecisionAt: new Date().toISOString() } };
});
"""

REFUSER = r"""return $input.all().map(i => ({ json: { ...i.json, tickets: [], erreur: 'Génération refusée par le demandeur (approbation ' + (i.json.approbationCanal || 'telegram') + ').' } }));
"""


def main():
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    for requis in ("Paramètres Mikhmon", "Mode simulation ?",
                   "Générer les tickets dans RouterOS",
                   "Préparer le récapitulatif", "Préparer le retour signé",
                   "Préparer l'erreur signée"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")
    if "Approbation requise ?" in noeuds:
        sys.exit("ECHEC : portillon déjà présent.")

    # 1) Paramètres : approbation lue depuis la config signée du job.
    params = noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"]
    params = une_fois(
        params,
        "  input.telegramBotToken = tgJob.jeton || '';",
        "  input.telegramBotToken = tgJob.jeton || '';\n"
        "  var apprJob = livraisonJob.approbation || {};\n"
        "  input.approbationRequise = apprJob.requise === true;\n"
        "  input.approbationCanal = String(apprJob.canal || 'telegram');\n"
        "  input.approbationDestinataire = String(apprJob.destinataire || '');",
        "params approbation entree",
    )
    params = une_fois(
        params,
        "  telegramBotToken: String(input.telegramBotToken || env('TELEGRAM_BOT_TOKEN', ''))\n};",
        "  telegramBotToken: String(input.telegramBotToken || env('TELEGRAM_BOT_TOKEN', '')),\n"
        "  approbationRequise: input.approbationRequise === true,\n"
        "  approbationCanal: String(input.approbationCanal || 'telegram'),\n"
        "  approbationDestinataire: String(input.approbationDestinataire || '')\n};",
        "params approbation shared",
    )
    noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"] = params

    # 2) Demande manuelle : même message de consentement.
    recap = noeuds["Préparer le récapitulatif"]["parameters"]["jsCode"]
    debut = recap.index("const text = `")
    fin = recap.index("`;", debut) + 2
    recap = recap[:debut] + "const text = `" + MESSAGE + "`;" + recap[fin:]
    noeuds["Préparer le récapitulatif"]["parameters"]["jsCode"] = recap

    # 3) Nouveaux nodes du portillon (positions après Mode simulation).
    def code(nom, js, x, y, ident):
        return {"parameters": {"jsCode": js}, "id": ident, "name": nom,
                "type": "n8n-nodes-base.code", "typeVersion": 2,
                "position": [x, y]}

    donnees["nodes"].extend([
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "",
                                "typeValidation": "loose", "version": 2},
                    "conditions": [{
                        "leftValue": "={{$json.approbationRequise}}",
                        "operator": {"type": "boolean", "operation": "true",
                                     "singleValue": True},
                        "id": "cond-approbation",
                    }],
                    "combinator": "and",
                },
                "options": {}, "looseTypeValidation": True,
            },
            "id": "a1100001-0001-4001-8001-000000000001",
            "name": "Approbation requise ?",
            "type": "n8n-nodes-base.if", "typeVersion": 2.2,
            "position": [1056, 272],
        },
        code("Préparer la demande d'approbation", PREPARER, 1120, 400,
             "a1100002-0002-4002-8002-000000000002"),
        {**code("Envoyer la demande d'approbation", ENVOYER, 1248, 400,
                "a1100003-0003-4003-8003-000000000003"),
         "onError": "continueErrorOutput"},
        {
            "parameters": {"resume": "webhook",
                           "options": {"webhookSuffix": "mikhmon-approval-auto"}},
            "id": "a1100004-0004-4004-8004-000000000004",
            "name": "Attendre l'approbation (auto)",
            "type": "n8n-nodes-base.wait", "typeVersion": 1.1,
            "position": [1376, 400],
        },
        code("Valider la décision (auto)", VALIDER, 1504, 400,
             "a1100005-0005-4005-8005-000000000005"),
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "",
                                "typeValidation": "loose", "version": 2},
                    "conditions": [{
                        "leftValue": "={{$json.approved}}",
                        "operator": {"type": "boolean", "operation": "true",
                                     "singleValue": True},
                        "id": "cond-accordee",
                    }],
                    "combinator": "and",
                },
                "options": {}, "looseTypeValidation": True,
            },
            "id": "a1100006-0006-4006-8006-000000000006",
            "name": "Approbation accordée ?",
            "type": "n8n-nodes-base.if", "typeVersion": 2.2,
            "position": [1632, 400],
        },
        code("Génération refusée (auto)", REFUSER, 1632, 544,
             "a1100007-0007-4007-8007-000000000007"),
    ])

    # 4) Connexions : Mode simulation (faux) -> portillon -> Générer.
    connexions = donnees["connections"]
    mode = connexions["Mode simulation ?"]["main"]
    assert mode[1][0]["node"] == "Générer les tickets dans RouterOS"
    mode[1] = [{"node": "Approbation requise ?", "type": "main", "index": 0}]
    connexions["Approbation requise ?"] = {"main": [
        [{"node": "Préparer la demande d'approbation", "type": "main", "index": 0}],
        [{"node": "Générer les tickets dans RouterOS", "type": "main", "index": 0}],
    ]}
    connexions["Préparer la demande d'approbation"] = {"main": [
        [{"node": "Envoyer la demande d'approbation", "type": "main", "index": 0}]]}
    connexions["Envoyer la demande d'approbation"] = {"main": [
        [{"node": "Attendre l'approbation (auto)", "type": "main", "index": 0}],
        [{"node": "Préparer l'erreur signée", "type": "main", "index": 0}],
    ]}
    connexions["Attendre l'approbation (auto)"] = {"main": [
        [{"node": "Valider la décision (auto)", "type": "main", "index": 0}]]}
    connexions["Valider la décision (auto)"] = {"main": [
        [{"node": "Approbation accordée ?", "type": "main", "index": 0}]]}
    connexions["Approbation accordée ?"] = {"main": [
        [{"node": "Générer les tickets dans RouterOS", "type": "main", "index": 0}],
        [{"node": "Génération refusée (auto)", "type": "main", "index": 0}],
    ]}
    connexions["Génération refusée (auto)"] = {"main": [
        [{"node": "Préparer le retour signé", "type": "main", "index": 0}]]}

    # 5) Validation structurelle.
    noms = [n["name"] for n in donnees["nodes"]]
    assert len(noms) == len(set(noms)), "Nom de node dupliqué."
    ids = [n["id"] for n in donnees["nodes"]]
    assert len(ids) == len(set(ids)), "Id dupliqué."
    for source, branches in connexions.items():
        assert source in noms, f"Connexion orpheline : {source}."
        for sortie in branches.get("main", []):
            for lien in sortie:
                assert lien["node"] in noms, f"Cible inconnue : {lien['node']}."

    horodatage = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    shutil.copyfile(FICHIER, str(FICHIER) + "." + horodatage + ".bak")
    FICHIER.write_text(json.dumps(donnees, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    print("OK : portillon d'approbation ajoute au flux automatique.")
    print("Nodes : " + str(len(noms)))


if __name__ == "__main__":
    main()
