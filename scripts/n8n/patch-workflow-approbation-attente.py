#!/usr/bin/env python3
"""Branche approbation : propage tenant/runId/callbackUrl et signale l'attente.

1. « Lire la demande (profil + quantite) » transmettait un objet reconstruit
   SANS tenantId, runId ni callbackUrl : tout l'aval (compte rendu signe,
   URL de reprise) echouait avec « tenantId manquant ». On ajoute ces champs.
2. Nouveau node « Signaler l'attente » entre « Preparer le recapitulatif »
   et « Notifier le demandeur (Telegram) » : POST signe
   { statut: 'en_attente', urlReprise, executionId, resume } vers
   /api/n8n/retour AVANT le node Wait, pour que l'ecran Approbations liste
   la demande. Meilleur effort : si l'application est injoignable, on
   continue (boutons Telegram de secours) en marquant attenteSignalee=false.
3. Recablage : recap -> Signaler l'attente -> Notifier.

Ne touche a aucune autre branche (generation directe, reappro, erreurs).
Usage : python3 scripts/patch-workflow-approbation-attente.py
"""
import copy
import json
import sys
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
CHEMIN = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"

NOM_LIRE = "Lire la demande (profil + quantité)"
NOM_RECAP = "Préparer le récapitulatif"
NOM_NOTIFIER = "Notifier le demandeur (Telegram)"
NOM_SIGNALER = "Signaler l'attente"

CHAMP_ANCRE = (
    "  approvalRecipient: String(input.approvalRecipient "
    "|| input.recipient || env('APPROVAL_RECIPIENT', ''))\n} }];"
)
CHAMP_AJOUT = (
    "  approvalRecipient: String(input.approvalRecipient "
    "|| input.recipient || env('APPROVAL_RECIPIENT', '')),",
    # Identite multi-utilisateur : todo l'aval (compte rendu signe,
    # URL de reprise, anti-doublon RouterOS) en a besoin.
    "  tenantId: String(input.tenantId || ''),",
    "  userId: String(input.userId || ''),",
    "  runId: String(input.runId || input.cleIdempotence || ''),",
    "  cleIdempotence: String(input.cleIdempotence || input.runId || ''),",
    "  callbackUrl: String(input.callbackUrl || '')\n} }];",
)

CODE_SIGNALER_CORPS = """// Mise en pause : previent l'application AVANT le node Wait, pour que
// l'ecran Approbations liste la demande (tenant + URL de reprise).
// Meilleur effort : si l'application est injoignable, on continue quand
// meme (les boutons Telegram restent une voie d'approbation de secours)
// mais on marque attenteSignalee=false pour le compte rendu final.
var secret = (typeof $env !== 'undefined' && $env && $env.N8N_CALLBACK_SECRET) || '';
if (!secret) throw new Error('N8N_CALLBACK_SECRET manquant : declarez-le dans le docker-compose de n8n.');
var sorties = [];
var items = $input.all();
for (var k = 0; k < items.length; k++) {
  var cfg = items[k].json || {};
  var tenantId = String(cfg.tenantId || '');
  var runId = String(cfg.runId || cfg.cleIdempotence || '');
  var callbackUrl = String(cfg.callbackUrl || '');
  var approvalUrl = String(cfg.approvalUrl || '');
  if (!tenantId) throw new Error('tenantId manquant : l\\'appelant doit envoyer le contrat 12 champs.');
  if (!runId) throw new Error('runId manquant : l\\'appelant doit envoyer runId (cle d\\'idempotence).');
  if (!callbackUrl) throw new Error('callbackUrl manquante : l\\'appelant doit fournir callbackUrl (APP_URL + /api/n8n/retour).');
  if (!approvalUrl || !/^https?:\\/\\//i.test(approvalUrl)) throw new Error('approvalUrl manquante : le node Wait doit exposer $execution.resumeUrl.');
  var contenu = {
    tenantId: tenantId,
    cleIdempotence: runId,
    statut: 'en_attente',
    urlReprise: approvalUrl,
    executionId: String($execution.id),
    workflow: 'mikhmon-tickets',
    resume: {
      profil: String(cfg.profile || ''),
      quantite: cfg.quantity,
      routeur: String(cfg.routeurNom || cfg.routerBaseUrl || ''),
      stockAvant: (cfg.stockAvailable !== undefined && cfg.stockAvailable !== null) ? cfg.stockAvailable : null,
      seuil: cfg.threshold,
      canal: String(cfg.deliveryChannel || '')
    }
  };
  var texte = canon(contenu);
  var horo = String(Date.now());
  var signature = hmacHex(secret, texte);
  var signalee = true;
  var erreurSignal = '';
  try {
    await this.helpers.httpRequest({
      method: 'POST', url: callbackUrl, body: texte,
      headers: { 'Content-Type': 'application/json', 'X-Signature': signature, 'X-Timestamp': horo, 'X-Run-Id': runId },
      timeout: 20000
    });
  } catch (e) { signalee = false; erreurSignal = String((e && e.message) || e).slice(0, 300); }
  var copie = {};
  for (var cle in cfg) copie[cle] = cfg[cle];
  copie.attenteSignalee = signalee;
  if (!signalee) copie.attenteErreur = erreurSignal;
  sorties.push({ json: copie });
}
return sorties;
"""


def main() -> int:
    wf = json.loads(CHEMIN.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in wf["nodes"]}

    # 1) Propagation tenant/runId/callbackUrl.
    lire = noeuds[NOM_LIRE]
    code_lire = lire["parameters"]["jsCode"]
    if "callbackUrl: String(input.callbackUrl" in code_lire:
        print("propagation deja presente, on la garde.")
    elif CHAMP_ANCRE not in code_lire:
        print("ERREUR : ancre introuvable dans Lire la demande.", file=sys.stderr)
        return 1
    else:
        lire["parameters"]["jsCode"] = code_lire.replace(
            CHAMP_ANCRE, "\n".join(CHAMP_AJOUT)
        )
        print("propagation tenant/runId/callbackUrl ajoutee.")

    # 2) Node Signaler l'attente (helpers de signature recopies a
    # l'identique depuis « Preparer le retour signe » : meme canon,
    # meme HMAC, donc signature verifiable par /api/n8n/retour).
    if NOM_SIGNALER in noeuds:
        print("node Signaler l'attente deja present.")
    else:
        retour = noeuds["Préparer le retour signé"]["parameters"]["jsCode"]
        marqueur = "// Compte rendu signe"
        coupe = retour.find(marqueur)
        if coupe < 0:
            print("ERREUR : helpers introuvables.", file=sys.stderr)
            return 1
        aides = retour[:coupe]
        if "function canon(" not in aides or "function hmacHex(" not in aides:
            print("ERREUR : canon/hmacHex absents des helpers.", file=sys.stderr)
            return 1
        recap = noeuds[NOM_RECAP]
        noeud = {
            "parameters": {"jsCode": aides + CODE_SIGNALER_CORPS},
            "id": str(uuid.uuid4()),
            "name": NOM_SIGNALER,
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [
                (recap["position"][0] + noeuds[NOM_NOTIFIER]["position"][0]) // 2,
                recap["position"][1],
            ],
        }
        wf["nodes"].append(noeud)
        print("node Signaler l'attente ajoute.")

    # 3) Recablage : recap -> Signaler -> Notifier.
    connexions = wf["connections"]
    sorties_recap = connexions[NOM_RECAP]["main"]
    cibles = [b["node"] for branche in sorties_recap for b in branche]
    if cibles == [NOM_SIGNALER]:
        print("recablage deja en place.")
    elif cibles != [NOM_NOTIFIER]:
        print(f"ERREUR : cible inattendue {cibles}.", file=sys.stderr)
        return 1
    else:
        connexions[NOM_RECAP] = {
            "main": [[{"node": NOM_SIGNALER, "type": "main", "index": 0}]]
        }
        connexions[NOM_SIGNALER] = {
            "main": [[{"node": NOM_NOTIFIER, "type": "main", "index": 0}]]
        }
        print("recablage recap -> Signaler -> Notifier fait.")

    # Garde-fous.
    noms = [n["name"] for n in wf["nodes"]]
    assert len(noms) == len(set(noms)), "noms de nodes en double"
    ids = [n["id"] for n in wf["nodes"]]
    assert len(ids) == len(set(ids)), "ids en double"

    CHEMIN.write_text(
        json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"ecrit : {CHEMIN.name} ({len(wf['nodes'])} nodes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
