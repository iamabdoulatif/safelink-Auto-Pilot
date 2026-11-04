#!/usr/bin/env python3
"""Routage Telegram multi-routeurs (catalogue dynamique RouterOS).

Remplace la liste statique de profils (03-JOURS, 01-SEMAINE, 01-MOIS)
par le catalogue temps réel de /api/telegram/catalogue :

- /start ou /tickets -> askRouters (routeurs actifs du chatId).
- Clic routeur:<id> -> askProfiles (rappelle le catalogue, filtre le
  routeur, affiche UNIQUEMENT les profils RouterOS).
- Clic prof:<routerId>:<profil> -> askQty (quantités).
- Clic qty:<routerId>:<profil>:<qty> -> generate (autoriser d'abord).
- Avant génération : POST /api/telegram/autoriser avec
  {chatId, routerId, profile, qty, simulation}.
- Refus propre : routeur inactif, profil absent, compte lecture
  manquant, utilisateur inconnu, routeur injoignable (motif explicite,
  jamais de génération à l'aveugle, aucun repli admin).
- Aucune liste statique de profils dans le workflow.

Idempotent : quitte 0 sans rien écrire si déjà appliqué.
Sauvegarde avant écriture dans /tmp/sauvegarde-workflow-*.
Utilisation : python3 scripts/n8n/patch-workflow-telegram-catalogue.py
"""

import copy
import json
import shutil
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
TG = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"

MARQUEUR = "catalogue dynamique via /api/telegram/catalogue"
QUANTITES = [120, 240, 480, 500]

AIGUILLER = """// Routage Telegram multi-routeurs : catalogue dynamique via /api/telegram/catalogue.
// /start ou /tickets -> askRouters (routeurs actifs du chatId).
// Clic routeur:<id> -> askProfiles (profils RouterOS du routeur choisi).
// Clic prof:<routerId>:<profil> -> askQty (quantites).
// Clic qty:<routerId>:<profil>:<qty> -> generate (autorisation puis generation).
// RouterOS (via le catalogue) est la seule source de profils : aucune liste
// statique ici. Resout le jeton du bot via /api/telegram/contexte (repli
// $env) sans jamais bloquer le routage.
var entree = $input.first().json || {};
var corps = (entree && typeof entree === 'object' && entree.body && typeof entree.body === 'object') ? entree.body : entree;
var msg = corps.message || corps.edited_message || null;
if (!msg && corps.message_id !== undefined && corps.chat) msg = corps;
var cb = corps.callback_query || null;
function idChatMessage(m) {
  if (!m) return null;
  if (m.chat && m.chat.id !== undefined && m.chat.id !== null) return String(m.chat.id);
  if (m.from && m.from.id !== undefined && m.from.id !== null) return String(m.from.id);
  return null;
}
var chatId = null; var userId = null; var source = 'message';
var donneesCallback = null; var idRequeteCallback = null;
if (cb && typeof cb === 'object') {
  source = 'callback';
  if (cb.message) chatId = idChatMessage(cb.message);
  if (!chatId && cb.from && cb.from.id !== undefined && cb.from.id !== null) chatId = String(cb.from.id);
  if (cb.from && cb.from.id !== undefined && cb.from.id !== null) userId = String(cb.from.id);
  if (typeof cb.data === 'string') donneesCallback = cb.data;
  if (typeof cb.id === 'string') idRequeteCallback = cb.id;
}
if (!chatId && msg) {
  chatId = idChatMessage(msg);
  if (msg.from && msg.from.id !== undefined && msg.from.id !== null) userId = String(msg.from.id);
}
if (!chatId) throw new Error('Mise à jour Telegram sans chat identifiable : ni callback_query.message.chat.id, ni from.id, ni message.chat.id.');
var texte = (msg && typeof msg.text === 'string') ? msg.text.trim() : '';
function estCommande(t, nom) { return t === '/' + nom || t.indexOf('/' + nom + '@') === 0 || t.indexOf('/' + nom + ' ') === 0; }
var jetonBot = '';
var appliUrl = String(($env && $env.APP_URL) || '').replace(/\\/$/, '');
var secretPartage = String(($env && $env.N8N_WEBHOOK_SECRET) || '');
if (appliUrl && secretPartage) {
  try {
    var ctx = await this.helpers.httpRequest({ method: 'POST', url: appliUrl + '/api/telegram/contexte', headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': secretPartage }, body: { chatId: chatId }, json: true, timeout: 8000 });
    var donnees = (ctx && ctx.data) || {};
    if (donnees.telegramBotToken) jetonBot = String(donnees.telegramBotToken);
  } catch (eCtx) { jetonBot = ''; }
}
var QUANTITES = [120, 240, 480, 500];
function routerIdValide(s) { var t = String(s == null ? '' : s); return /^\\d+$/.test(t) && parseInt(t, 10) > 0; }
function profilValide(s) { var p = String(s == null ? '' : s); return p !== '' && p.length <= 64; }
function quantiteValide(q) { return QUANTITES.indexOf(q) !== -1; }
function base(extra) {
  var o = { chatId: chatId, userId: userId, telegramBotToken: jetonBot, source: source };
  if (extra) for (var k in extra) o[k] = extra[k];
  return [{ json: o }];
}
function erreurSelection() { return base({ route: 'ackErreur', errorCode: 'ERREUR_SELECTION', errorText: 'Erreur de sélection.', callbackQueryId: idRequeteCallback }); }
if (texte !== '' && (estCommande(texte, 'start') || estCommande(texte, 'tickets'))) return base({ route: 'askRouters' });
if (donneesCallback && donneesCallback.indexOf('routeur:') === 0) {
  var rid = donneesCallback.slice(8);
  if (!routerIdValide(rid)) return erreurSelection();
  return base({ route: 'askProfiles', routerId: parseInt(rid, 10), callbackQueryId: idRequeteCallback });
}
if (donneesCallback && donneesCallback.indexOf('prof:') === 0) {
  var reste = donneesCallback.slice(5).split(':');
  var rpid = reste[0]; var pnom = reste.slice(1).join(':');
  if (!routerIdValide(rpid) || !profilValide(pnom)) return erreurSelection();
  return base({ route: 'askQty', routerId: parseInt(rpid, 10), profile: pnom, callbackQueryId: idRequeteCallback });
}
if (donneesCallback && donneesCallback.indexOf('qty:') === 0) {
  var morceaux = donneesCallback.slice(4).split(':');
  var qrid = morceaux[0]; var qp = morceaux.slice(1, -1).join(':'); var qq = parseInt(morceaux[morceaux.length - 1], 10);
  if (!routerIdValide(qrid) || !profilValide(qp) || !quantiteValide(qq)) return erreurSelection();
  return base({ route: 'generate', routerId: parseInt(qrid, 10), profile: qp, qty: qq, callbackQueryId: idRequeteCallback });
}
if (texte !== '') {
  var m = String(texte).trim().match(/(\\d+)/);
  if (m && quantiteValide(parseInt(m[1], 10))) return base({ route: 'help', errorCode: 'QUANTITE_SANS_PROFIL', qty: parseInt(m[1], 10) });
  if (texte.charAt(0) === '/') return base({ route: 'help' });
  return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });
}
if (idRequeteCallback) return erreurSelection();
return base({ route: 'help' });"""

LISTER_ROUTEURS = """// Routeurs actifs du chat : POST /api/telegram/catalogue {chatId} (X-N8N-Secret).
// Affiche UNIQUEMENT les routeurs actifs associes, boutons routeur:<id>.
// Catalogue vide, chat inconnu ou erreur -> message de refus explicite.
// Jamais de liste statique.
var items = $input.all();
var out = [];
var appli = String(($env && $env.APP_URL) || '').replace(/\\/$/, '');
var secret = String(($env && $env.N8N_WEBHOOK_SECRET) || '');
for (var k = 0; k < items.length; k++) {
  var e = items[k].json || {};
  var chatId = String(e.chatId || '');
  var jeton = String(e.telegramBotToken || (($env && $env.TELEGRAM_BOT_TOKEN) || ''));
  var suivi = {};
  for (var c in e) suivi[c] = e[c];
  var texte = '';
  var clavier = null;
  var motif = '';
  if (!chatId) {
    motif = 'Discussion inconnue : envoyez /start depuis votre compte.';
  } else if (!appli || !secret) {
    motif = 'Service indisponible : configuration SafeLink incomplète.';
  } else {
    try {
      var rep = await this.helpers.httpRequest({ method: 'POST', url: appli + '/api/telegram/catalogue', headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': secret }, body: { chatId: chatId }, json: true, timeout: 15000 });
      var donnees = (rep && rep.data) || {};
      var routeurs = Array.isArray(donnees.routeurs) ? donnees.routeurs : [];
      var actifs = routeurs.filter(function (r) { return r && r.disponible === true; });
      if (actifs.length === 0) {
        motif = String(donnees.motif || 'Aucun routeur actif associé à cette discussion.');
      } else {
        texte = '🛰️ Choisissez un routeur :';
        clavier = { inline_keyboard: actifs.map(function (r) { return [{ text: String(r.nom || ('Routeur ' + r.id)), callback_data: 'routeur:' + String(r.id) }]; }) };
      }
    } catch (err) {
      motif = 'Catalogue indisponible : ' + String((err && err.message) || err).slice(0, 200);
    }
  }
  if (!texte) texte = '⛔ Accès non autorisé.' + (motif ? ' ' + motif : '');
  if (jeton && chatId) {
    try {
      await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendMessage', body: { chat_id: chatId, text: texte, ...(clavier ? { reply_markup: clavier } : {}) }, json: true, timeout: 15000 });
      suivi.messageEnvoye = true;
    } catch (err) {
      var m = String((err && err.message) || err).replace(/bot\\d+:[A-Za-z0-9_-]{10,}/g, 'bot***');
      suivi.erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!chatId, runId: e.runId || null, detail: m.slice(0, 300) };
    }
  } else if (!suivi.erreurEnvoi) {
    suivi.erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!chatId, runId: e.runId || null, detail: 'jeton ou chatId manquant' };
  }
  if (motif) suivi.motif = motif;
  out.push({ json: suivi });
}
return out;"""

PROPOSER_PROFILS = """// Profils RouterOS du routeur choisi : rappelle /api/telegram/catalogue,
// filtre le routerId, affiche UNIQUEMENT les profils réellement retournés
// par RouterOS, boutons prof:<routerId>:<profil>. Aucune liste statique.
// Routeur inactif, profil vide, catalogue injoignable ou chat inconnu ->
// message de refus explicite (jamais de génération à l'aveugle).
var items = $input.all();
var out = [];
var appli = String(($env && $env.APP_URL) || '').replace(/\\/$/, '');
var secret = String(($env && $env.N8N_WEBHOOK_SECRET) || '');
for (var k = 0; k < items.length; k++) {
  var e = items[k].json || {};
  var chatId = String(e.chatId || '');
  var routerId = parseInt(e.routerId, 10);
  var jeton = String(e.telegramBotToken || (($env && $env.TELEGRAM_BOT_TOKEN) || ''));
  var suivi = {};
  for (var c in e) suivi[c] = e[c];
  var texte = '';
  var clavier = null;
  var motif = '';
  if (!chatId) {
    motif = 'Discussion inconnue : envoyez /start depuis votre compte.';
  } else if (!Number.isInteger(routerId) || routerId <= 0) {
    motif = 'Routeur non choisi : touchez un routeur dans la liste.';
  } else if (!appli || !secret) {
    motif = 'Service indisponible : configuration SafeLink incomplète.';
  } else {
    try {
      var rep = await this.helpers.httpRequest({ method: 'POST', url: appli + '/api/telegram/catalogue', headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': secret }, body: { chatId: chatId }, json: true, timeout: 15000 });
      var donnees = (rep && rep.data) || {};
      var routeurs = Array.isArray(donnees.routeurs) ? donnees.routeurs : [];
      var trouve = null;
      for (var i = 0; i < routeurs.length; i++) {
        if (Number(routeurs[i] && routeurs[i].id) === routerId) { trouve = routeurs[i]; break; }
      }
      if (!trouve) {
        motif = 'Routeur indisponible ou inactif.';
      } else if (trouve.disponible !== true) {
        motif = String(trouve.erreur || 'Routeur injoignable ou compte de lecture non configuré.');
      } else {
        var profils = Array.isArray(trouve.profils) ? trouve.profils.filter(function (p) { return p && String(p.nom || '').trim() !== ''; }) : [];
        if (profils.length === 0) {
          motif = 'Aucun profil sur ce routeur.';
        } else {
          texte = '🎟️ ' + String(trouve.nom || ('Routeur ' + routerId)) + ' — quel profil ?';
          clavier = { inline_keyboard: profils.map(function (p) { return [{ text: String(p.nom), callback_data: 'prof:' + routerId + ':' + String(p.nom) }]; }) };
        }
      }
    } catch (err) {
      motif = 'Catalogue indisponible : ' + String((err && err.message) || err).slice(0, 200);
    }
  }
  if (!texte) texte = '⛔ Accès non autorisé.' + (motif ? ' ' + motif : '');
  if (jeton && chatId) {
    try {
      await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendMessage', body: { chat_id: chatId, text: texte, ...(clavier ? { reply_markup: clavier } : {}) }, json: true, timeout: 15000 });
      suivi.messageEnvoye = true;
    } catch (err) {
      var m = String((err && err.message) || err).replace(/bot\\d+:[A-Za-z0-9_-]{10,}/g, 'bot***');
      suivi.erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!chatId, runId: e.runId || null, detail: m.slice(0, 300) };
    }
  } else if (!suivi.erreurEnvoi) {
    suivi.erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!chatId, runId: e.runId || null, detail: 'jeton ou chatId manquant' };
  }
  if (motif) suivi.motif = motif;
  out.push({ json: suivi });
}
return out;"""

PROPOSER_QUOTAS = """// Quantités pour (routeur, profil) : boutons qty:<routerId>:<profil>:<qty>.
// Les quantités autorisées sont celles de /api/telegram/autoriser.
var items = $input.all();
var out = [];
var QUANTITES = [120, 240, 480, 500];
for (var k = 0; k < items.length; k++) {
  var e = items[k].json || {};
  var chatId = String(e.chatId || '');
  var routerId = parseInt(e.routerId, 10);
  var profile = String(e.profile || '');
  var jeton = String(e.telegramBotToken || (($env && $env.TELEGRAM_BOT_TOKEN) || ''));
  var suivi = {};
  for (var c in e) suivi[c] = e[c];
  var texte = '';
  var clavier = null;
  var motif = '';
  if (!chatId) {
    motif = 'Discussion inconnue : envoyez /start depuis votre compte.';
  } else if (!Number.isInteger(routerId) || routerId <= 0 || profile === '') {
    motif = 'Choix incomplet : touchez d\\u2019abord un routeur puis un profil.';
  } else {
    texte = '🎟️ Profil ' + profile + ' — combien de tickets ?';
    clavier = { inline_keyboard: [[{ text: '🎟️ 120', callback_data: 'qty:' + routerId + ':' + profile + ':120' }, { text: '🎟️ 240', callback_data: 'qty:' + routerId + ':' + profile + ':240' }], [{ text: '🎟️ 480', callback_data: 'qty:' + routerId + ':' + profile + ':480' }, { text: '🎟️ 500', callback_data: 'qty:' + routerId + ':' + profile + ':500' }]] };
  }
  if (!texte) texte = '⛔ Accès non autorisé.' + (motif ? ' ' + motif : '');
  if (jeton && chatId) {
    try {
      await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendMessage', body: { chat_id: chatId, text: texte, ...(clavier ? { reply_markup: clavier } : {}) }, json: true, timeout: 15000 });
      suivi.messageEnvoye = true;
    } catch (err) {
      var m = String((err && err.message) || err).replace(/bot\\d+:[A-Za-z0-9_-]{10,}/g, 'bot***');
      suivi.erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!chatId, runId: e.runId || null, detail: m.slice(0, 300) };
    }
  } else if (!suivi.erreurEnvoi) {
    suivi.erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!chatId, runId: e.runId || null, detail: 'jeton ou chatId manquant' };
  }
  if (motif) suivi.motif = motif;
  out.push({ json: suivi });
}
return out;"""

VERIFIER = """// Droits cote SafeLink : chatId -> tenant, bot + routeur CHOISI.
// POST /api/telegram/autoriser {chatId, routerId, profile, qty, simulation}.
// Sans reponse SafeLink valide : REFUS (jamais de generation a l'aveugle,
// aucun repli : un ticket n'est cree que sur autorisation explicite).
var items = $input.all();
var out = [];
var secret = String(($env && $env.N8N_WEBHOOK_SECRET) || '');
var appli = String(($env && $env.APP_URL) || '').replace(/\\/$/, '');
var SIM = String(($env && $env.SIMULATION) || '').toLowerCase() === 'true';
for (var k = 0; k < items.length; k++) {
  var e = items[k].json || {};
  var acces = { autorise: false, motif: 'Vérification impossible.' };
  if (appli && secret) {
    try {
      var rep = await this.helpers.httpRequest({ method: 'POST', url: appli + '/api/telegram/autoriser', headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': secret }, body: { chatId: String(e.chatId || ''), routerId: Number(e.routerId), profile: String(e.profile || ''), qty: Number(e.qty), simulation: (e.simulation === true || SIM) }, json: true, timeout: 15000 });
      var d = (rep && rep.data) || {};
      if (d.autorise === true) acces = { autorise: true, tenantId: d.tenantId, userId: d.userId, routerConnectionId: d.routerConnectionId, routeurNom: d.routeurNom, routerBaseUrl: d.routerBaseUrl, routerUser: d.routerUser, routerPassword: d.routerPassword, telegramBotToken: d.telegramBotToken, telegramMode: d.telegramMode, runId: d.runId, profile: d.profile, qty: d.qty, limitUptime: (d.limitUptime || ''), limitBytesTotal: (d.limitBytesTotal || '') };
      else acces = { autorise: false, motif: String(d.motif || (rep && rep.error) || 'Accès refusé.') };
    } catch (err) {
      acces = { autorise: false, motif: 'Vérification impossible : ' + String((err && err.message) || err).slice(0, 200) };
    }
  }
  var mel = {};
  for (var c in e) mel[c] = e[c];
  for (var a in acces) mel[a] = acces[a];
  mel.simulation = (e.simulation === true || SIM);
  out.push({ json: mel });
}
return out;"""


def charger():
    with open(TG, encoding="utf-8") as f:
        return json.load(f)


def ecrire(doc):
    sauvegarde = (
        Path("/tmp")
        / ("sauvegarde-workflow-" + TG.stem + "-" + str(int(time.time())))
    )
    shutil.copyfile(TG, sauvegarde)
    print("Sauvegarde : " + str(sauvegarde))
    with open(TG, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")


def noeud(doc, nom):
    for n in doc["nodes"]:
        if n["name"] == nom:
            return n
    raise SystemExit("Node introuvable : " + nom)


doc = charger()
# Déjà appliqué ?
aiguiller_courant = noeud(doc, "Aiguiller")["parameters"]["jsCode"]
if MARQUEUR in aiguiller_courant and "Lister les routeurs" in {
    n["name"] for n in doc["nodes"]
}:
    print("Catalogue : déjà appliqué.")
    raise SystemExit(0)

# 1) Aiguiller réécrit (routage multi-routeurs, sans liste statique).
noeud(doc, "Aiguiller")["parameters"]["jsCode"] = AIGUILLER
print("Aiguiller : routage routeur -> profil -> quantité.")

# 2) Nouveau node « Lister les routeurs » (terminal, comme les autres envois).
if "Lister les routeurs" not in {n["name"] for n in doc["nodes"]}:
    doc["nodes"].append(
        {
            "parameters": {"jsCode": LISTER_ROUTEURS},
            "id": str(uuid.uuid4()),
            "name": "Lister les routeurs",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [256, -128],
        }
    )
    doc["connections"]["Lister les routeurs"] = {
        "main": [
            [],
            [{"node": "Signaler l'échec Telegram", "type": "main", "index": 0}],
        ]
    }
    print("Node « Lister les routeurs » créé.")
else:
    noeud(doc, "Lister les routeurs")["parameters"]["jsCode"] = LISTER_ROUTEURS

# 3) « Proposer les profils » devient un node Code dynamique (même nom,
# connexions inchangées : terminal + échec).
profils = noeud(doc, "Proposer les profils")
profils["type"] = "n8n-nodes-base.code"
profils["typeVersion"] = 2
profils["parameters"] = {"jsCode": PROPOSER_PROFILS}
profils.pop("credentials", None)
print("Proposer les profils : catalogue dynamique.")

# 4) « Proposer les quotas » devient un node Code dynamique (même nom).
quotas = noeud(doc, "Proposer les quotas")
quotas["type"] = "n8n-nodes-base.code"
quotas["typeVersion"] = 2
quotas["parameters"] = {"jsCode": PROPOSER_QUOTAS}
quotas.pop("credentials", None)
print("Proposer les quotas : callbacks qty:<routeur>:<profil>:<qty>.")

# 5) Vérifier l'utilisateur : autoriser AVEC routerId, sans repli admin.
noeud(doc, "Vérifier l'utilisateur")["parameters"]["jsCode"] = VERIFIER
print("Vérifier l'utilisateur : autoriser avec routerId, refus sans SafeLink.")

# 6) Générer : préfixe dérivé du profil (aucun profil statique), le
# profil est vérifié sur le routeur (nomsProfils) avant écriture.
generer = noeud(doc, "Generer les tickets")["parameters"]["jsCode"]
ancre_prefix = 'const PREFIX = {"03-JOURS": "3j", "01-SEMAINE": "7j", "01-MOIS": "30j"};'
if ancre_prefix in generer:
    generer = generer.replace(
        ancre_prefix,
        "const prefixeDe = function (nom) { var b = String(nom || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4); return b || 'tk'; };",
    )
    print("Generer : préfixe dérivé du profil.")
ancre_lecture = "const prefix = PREFIX[profile];"
if ancre_lecture in generer:
    generer = generer.replace(
        ancre_lecture, "const prefix = prefixeDe(profile);"
    )
ancre_tarife = "if (!prefix) throw new Error('Profil non tarifé : ' + profile);"
if ancre_tarife in generer:
    generer = generer.replace(ancre_tarife, "")
    print("Generer : refus « non tarifé » supprimé (tout profil RouterOS).")
noeud(doc, "Generer les tickets")["parameters"]["jsCode"] = generer

# 7) Aide : texte générique, sans liste statique de profils.
aide = noeud(doc, "Aide")
texte_aide = aide["parameters"].get("text", "")
if "03-JOURS" in texte_aide:
    aide["parameters"]["text"] = (
        "={{ $json.errorCode === 'QUANTITE_SANS_PROFIL' "
        "? 'Sélectionnez d\\u2019abord un profil.' "
        ": 'Envoyez /tickets : choisissez un routeur, puis un profil, "
        "puis une quantité (120 / 240 / 480 / 500).' }}"
    )
    print("Aide : texte générique sans profils en dur.")

# 8) Router : nouvelle règle askRouters en tête (Routeurs), le reste suit.
routeur = noeud(doc, "Router")
regles = routeur["parameters"]["rules"]["values"]
droites = [
    r["conditions"]["conditions"][0].get("rightValue") for r in regles
]
if "askRouters" not in droites:
    modele = copy.deepcopy(regles[0])
    modele["conditions"]["conditions"][0]["rightValue"] = "askRouters"
    modele["conditions"]["conditions"][0]["id"] = str(uuid.uuid4())
    modele["outputKey"] = "Routeurs"
    regles.insert(0, modele)
    doc["connections"]["Router"]["main"].insert(
        0, [{"node": "Lister les routeurs", "type": "main", "index": 0}]
    )
    print("Router : règle askRouters (-> Lister les routeurs).")

# 9) Validation structurelle (mêmes règles que les vagues précédentes).
noms = [n["name"] for n in doc["nodes"]]
assert len(noms) == len(set(noms)), "Nom de node dupliqué."
ids = [n.get("id") for n in doc["nodes"]]
assert len(ids) == len(set(ids)), "Id dupliqué."
for source, branches in doc["connections"].items():
    assert source in noms, "Connexion orpheline : " + source
    for sortie in branches.get("main", []):
        for lien in sortie or []:
            assert lien["node"] in noms, "Cible inconnue : " + lien["node"]
brut = json.dumps(doc, ensure_ascii=False)
for statique in ("03-JOURS", "01-SEMAINE", "01-MOIS", "NORMALISER_PROFIL"):
    assert statique not in brut, "Statique résiduel : " + statique
print("OK : aucun profil statique dans le workflow.")

ecrire(doc)
print("OK : routage catalogue appliqué.")
