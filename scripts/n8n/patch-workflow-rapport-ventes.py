#!/usr/bin/env python3
"""Branche « Rapport des ventes » du workflow Mikhmon (Mikhmon SF).

Au cycle de 15 minutes, le workflow demande au SaaS les rapports dus
(cycles de 00h à 00h définis dans le dashboard : décade 1-10 / 11-20 /
21-fin, hebdomadaire, mensuel, personnalisé), calcule les ventes sur
RouterOS (tickets utilisés du lot de la période, prix du profil),
envoie le point complet au gérant et à l'admin, le résumé de zone à
chaque vendeur (WhatsApp ou Telegram selon la zone), puis clôture
l'envoi côté SaaS. Aucun mot de passe de ticket ne transite.

Ajouts seulement, ancrages vérifiés, sauvegarde horodatée.
Usage : python3 scripts/n8n/patch-workflow-rapport-ventes.py
"""

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"

CALCULER = r"""// Ventes de la période sur RouterOS : un ticket VENDU = ticket
// déjà utilisé (uptime > 0) dont le lot (commentaire vc-<lot>-<date>)
// tombe dans la période [début 00:00, fin 00:00). Montant = tickets
// vendus x prix du profil (lu dans on-login, comme Mikhmon SF).
var cfg = (($input.first() || {}).json || {}).data || {};
var routeur = cfg.routeur || {};
if (!routeur.adresse || !routeur.motDePasse) throw new Error('Configuration rapport incomplète.');
var auth = 'Basic ' + Buffer.from(routeur.utilisateur + ':' + routeur.motDePasse).toString('base64');
var headers = { Authorization: auth, Accept: 'application/json' };
function liste(rep) { return Array.isArray(rep) ? rep : (rep.data || rep.results || []); }
function parseUptime(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0;
  var s = String(v).trim();
  if (s === '' || s === '0' || s === '0s') return 0;
  var m = s.match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && m[0] !== '') { var g = function (i) { return parseInt(m[i] || '0', 10); }; return (((g(1) * 7 + g(2)) * 24 + g(3)) * 60 + g(4)) * 60 + g(5); }
  return 1;
}
function dateDuLot(commentaire) {
  var m = String(commentaire || '').match(/vc-\d+-(\d{2})\.(\d{2})\.(\d{2})/);
  if (!m) return '';
  return '20' + m[3] + '-' + m[1] + '-' + m[2];
}
function prixProfil(onLogin) {
  var c = String(onLogin || '').split(',');
  var num = function (v) { return parseInt(String(v === undefined || v === null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0; };
  return num(c[4]) || num(c[2]);
}
function fmt(n) { return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F'; }
var users = liste(await this.helpers.httpRequest({ method: 'GET', url: routeur.adresse + '/rest/ip/hotspot/user', headers: headers, json: true, timeout: 30000, skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String(($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1) }));
var profs = liste(await this.helpers.httpRequest({ method: 'GET', url: routeur.adresse + '/rest/ip/hotspot/user/profile', headers: headers, json: true, timeout: 30000, skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String(($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1) }));
var prix = {};
for (var p = 0; p < profs.length; p++) prix[String(profs[p].name)] = prixProfil(profs[p]['on-login']);
var debut = String((cfg.periode || {}).debut || '');
var fin = String((cfg.periode || {}).fin || '');
var parProfil = {};
var totalVendu = 0;
var ticketsVendus = 0;
for (var u = 0; u < users.length; u++) {
  var user = users[u];
  if (parseUptime(user.uptime) <= 0) continue;
  var jour = dateDuLot(user.comment);
  if (!jour || jour < debut || jour >= fin) continue;
  var profil = String(user.profile || '');
  if (!parProfil[profil]) parProfil[profil] = { profil: profil, tickets: 0, prixUnitaire: prix[profil] || 0, montant: 0 };
  parProfil[profil].tickets += 1;
  parProfil[profil].montant = parProfil[profil].tickets * parProfil[profil].prixUnitaire;
  ticketsVendus += 1;
  totalVendu += parProfil[profil].prixUnitaire;
}
var appUrl = '';
try { appUrl = String((($('Signer la lecture rapport').first() || {}).json || {}).appUrl || ''); } catch (eApp) {}
var copie = {};
for (var k in cfg) copie[k] = cfg[k];
copie.appUrl = appUrl;
copie.ticketsVendus = ticketsVendus;
copie.totalVendu = totalVendu;
copie.parProfil = Object.keys(parProfil).sort().map(function (nom) { return parProfil[nom]; });
copie.montantFormate = fmt(totalVendu);
return [{ json: copie }];
"""

ENVOYER = r"""// Envoie le point des ventes. Gérant et admin : total + détail
// par profil. Chaque vendeur : le point de sa zone. Canal de la
// zone : WhatsApp (adaptateur) ou Telegram (chat de l'espace).
const sorties = [];
for (const item of $input.all()) {
  const cfg = item.json || {};
  const zone = cfg.zone || {};
  const fmt = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';
  const periode = 'du ' + String((cfg.periode || {}).debut || '') + ' au ' + String((cfg.periode || {}).fin || '') + ' (00h à 00h)';
  const detail = (cfg.parProfil || []).map((p) => '• ' + p.profil + ' : ' + p.tickets + ' tickets · ' + fmt(p.montant)).join('\n');
  const entete = '📊 Rapport des ventes — ' + (zone.nom || 'Zone Wi-Fi')
    + (zone.localisation || zone.commune ? '\n📍 ' + [zone.localisation, zone.commune].filter(Boolean).join(', ') : '')
    + '\n🗓️ Période ' + periode
    + '\n🎟️ Tickets vendus : ' + cfg.ticketsVendus
    + '\n💰 Total vendu : ' + fmt(cfg.totalVendu);
  const texteGestion = entete + (detail ? '\n\nDétail par profil :\n' + detail : '\n\nAucune vente sur la période.');
  const texteVendeur = entete + '\n\nPoint de votre zone. Le détail complet est chez le gérant.';
  const canal = String(cfg.canal || 'whatsapp');
  const canaux = cfg.canaux || {};
  let envois = 0;
  if (canal === 'telegram') {
    const jeton = String(canaux.telegramBotToken || '');
    const chat = String(canaux.telegramChatId || '');
    if (!jeton || !chat) throw new Error('Telegram non configuré pour le rapport.');
    await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendMessage', body: { chat_id: chat, text: texteGestion }, json: true, timeout: 30000 });
    envois = 1;
  } else {
    const url = String(canaux.whatsappWebhookUrl || '');
    if (!url) throw new Error('Adaptateur WhatsApp non configuré pour le rapport.');
    const destinataires = [];
    const vus = new Set();
    const ajouter = (numero, texte) => { const n = String(numero || '').trim(); if (n && !vus.has(n)) { vus.add(n); destinataires.push({ to: n, text: texte }); } };
    ajouter(zone.numeroAdmin, texteGestion);
    ajouter(zone.numeroGerant, texteGestion);
    for (const v of (zone.numerosVendeurs || [])) ajouter(v, texteVendeur);
    if (!destinataires.length) throw new Error('Aucun numéro de zone pour le rapport.');
    for (const d of destinataires) {
      await this.helpers.httpRequest({ method: 'POST', url, body: { to: d.to, text: d.text, message: d.text }, json: true, timeout: 30000 });
      envois += 1;
    }
  }
  sorties.push({ json: { ...cfg, rapportEnvois: envois } });
}
return sorties;
"""

FRACTIONNER = r"""var entree = ($input.first() || {}).json || {};
var donnees = entree.data || {};
var jobs = Array.isArray(donnees.jobs) ? donnees.jobs : [];
var appUrl = '';
try { appUrl = ($("Signer l'appel rapports").first().json || {}).appUrl || ''; } catch (e) { throw new Error('Rafale rapports introuvable.'); }
return jobs.map(function (job) { return { json: Object.assign({}, job, { appUrl: appUrl }) }; });
"""


def main():
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    for requis in ("Contrôle périodique (15 min)", "Signer l'appel jobs",
                   "Signer la lecture config"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")
    if "Calculer le rapport des ventes" in noeuds:
        sys.exit("ECHEC : branche rapport déjà présente.")

    # Signatures : mêmes fonctions HMAC que les jobs, corps adapté.
    signer_jobs = noeuds["Signer l'appel jobs"]["parameters"]["jsCode"]
    signer_rapports = signer_jobs.replace(
        "canon({ simulation: simulation, horodatage: horodatage, rafale: rafale })",
        "canon({ rapports: true, horodatage: horodatage, rafale: rafale })")
    assert signer_rapports != signer_jobs

    signer_lecture = noeuds["Signer la lecture config"]["parameters"]["jsCode"]
    signer_lecture_rapport = signer_lecture.replace(
        "if (!job.runId) throw new Error('Job sans runId.');",
        "if (!job.rapportId) throw new Error('Rapport sans rapportId.');")
    assert signer_lecture_rapport != signer_lecture

    # Retour signé : préfixe HMAC commun + corps du rapport.
    marque = "// Compte rendu signe"
    prefixe = signer_jobs[:signer_jobs.index(marque)]
    signer_retour = prefixe + r"""var secretInterne = (($env && $env.N8N_CALLBACK_SECRET) || '');
if (!secretInterne) throw new Error('N8N_CALLBACK_SECRET manquant.');
return $input.all().map(function (entree) {
  var cfg = entree.json || {};
  if (!cfg.rapportId) throw new Error('Rapport sans rapportId.');
  var texte = canon({ rapportId: String(cfg.rapportId), totalVendu: cfg.totalVendu || 0, ticketsVendus: cfg.ticketsVendus || 0 });
  return { json: { corps: texte, signature: hmacHex(secretInterne, texte), horodatage: String(Date.now()), rapportId: String(cfg.rapportId), appUrl: String(cfg.appUrl || '') } };
});
"""

    def code(nom, js, x, y, ident):
        return {"parameters": {"jsCode": js}, "id": ident, "name": nom,
                "type": "n8n-nodes-base.code", "typeVersion": 2,
                "position": [x, y]}

    donnees["nodes"].extend([
        code("Signer l'appel rapports", signer_rapports, 304, 640,
             "a2200001-0001-4001-8001-000000000001"),
        {
            "parameters": {
                "method": "POST",
                "url": "={{$json.appUrl}}/api/internal/n8n/rapports/jobs",
                "sendBody": True, "specifyBody": "json",
                "jsonBody": "={{$json.corps}}", "sendHeaders": True,
                "headerParameters": {"parameters": [
                    {"name": "X-Signature", "value": "={{$json.signature}}"},
                    {"name": "X-Timestamp", "value": "={{$json.horodatage}}"},
                    {"name": "X-Run-Id", "value": "={{$json.rafale}}"}]},
                "options": {"timeout": 15000},
            },
            "id": "a2200002-0002-4002-8002-000000000002",
            "name": "Récupérer les rapports dus",
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": [432, 640],
        },
        code("Fractionner les rapports", FRACTIONNER, 560, 640,
             "a2200003-0003-4003-8003-000000000003"),
        code("Signer la lecture rapport", signer_lecture_rapport, 688, 640,
             "a2200004-0004-4004-8004-000000000004"),
        {
            "parameters": {
                "method": "GET",
                "url": "={{$json.appUrl}}/api/internal/n8n/rapports/{{$json.rapportId}}",
                "sendHeaders": True,
                "headerParameters": {"parameters": [
                    {"name": "X-Signature", "value": "={{$json.configSignature}}"},
                    {"name": "X-Timestamp", "value": "={{$json.configHorodatage}}"},
                    {"name": "X-Run-Id", "value": "={{$json.rapportId}}"}]},
                "options": {"timeout": 15000},
            },
            "id": "a2200005-0005-4005-8005-000000000005",
            "name": "Lire la configuration du rapport",
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": [816, 640],
        },
        code("Calculer le rapport des ventes", CALCULER, 944, 640,
             "a2200006-0006-4006-8006-000000000006"),
        code("Envoyer le rapport des ventes", ENVOYER, 1072, 640,
             "a2200007-0007-4007-8007-000000000007"),
        code("Signer le retour rapport", signer_retour, 1200, 640,
             "a2200008-0008-4008-8008-000000000008"),
        {
            "parameters": {
                "method": "POST",
                "url": "={{$json.appUrl}}/api/internal/n8n/rapports/{{$json.rapportId}}/termine",
                "sendBody": True, "specifyBody": "json",
                "jsonBody": "={{$json.corps}}", "sendHeaders": True,
                "headerParameters": {"parameters": [
                    {"name": "X-Signature", "value": "={{$json.signature}}"},
                    {"name": "X-Timestamp", "value": "={{$json.horodatage}}"},
                    {"name": "X-Run-Id", "value": "={{$json.rapportId}}"}]},
                "options": {"timeout": 15000},
            },
            "id": "a2200009-0009-4009-8009-000000000009",
            "name": "Marquer le rapport envoyé",
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": [1328, 640],
        },
    ])

    connexions = donnees["connections"]
    controle = connexions["Contrôle périodique (15 min)"]["main"][0]
    controle.append({"node": "Signer l'appel rapports", "type": "main", "index": 0})
    chaine = [
        ("Signer l'appel rapports", "Récupérer les rapports dus"),
        ("Récupérer les rapports dus", "Fractionner les rapports"),
        ("Fractionner les rapports", "Signer la lecture rapport"),
        ("Signer la lecture rapport", "Lire la configuration du rapport"),
        ("Lire la configuration du rapport", "Calculer le rapport des ventes"),
        ("Calculer le rapport des ventes", "Envoyer le rapport des ventes"),
        ("Envoyer le rapport des ventes", "Signer le retour rapport"),
        ("Signer le retour rapport", "Marquer le rapport envoyé"),
    ]
    for source, cible in chaine:
        connexions[source] = {"main": [[{"node": cible, "type": "main", "index": 0}]]}

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
    print("OK : branche rapport des ventes ajoutée.")
    print("Nodes : " + str(len(noms)))


if __name__ == "__main__":
    main()
