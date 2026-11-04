#!/usr/bin/env python3
"""Correctif du dialogue Telegram autonome (workflow-telegram-tickets.json).

Cause : boutons envoyes en additionalFields.reply_markup (format ignore
par le noeud Telegram n8n 2.45.7) + Aiguiller ne gerait ni le texte
saisi (« 3 jours ») ni les commandes suffixees -> boucle d'aide.

Correctifs :
  A1 Aiguiller reecrit : extraction robuste (body/message/edited_message/
     callback_query), chatId prioritaire, userId, commandes /start
     /tickets (suffixes @bot et args acceptes), callbacks prof:/qty:,
     normalisation texte (8 formes + quantites), sorties exigees
     (route/chatId/userId/source/profile/qty/callbackQueryId/errorCode),
     resolution du jeton via /api/telegram/contexte (repli $env).
  A2 Proposer les profils / quotas en replyMarkup:inlineKeyboard natif
     (3 boutons profils, 4 quantites dynamiques par profil).
  A3 2 nodes « Accuser ... » (answerCallbackQuery via helpers, jamais
     bloquant, erreur formatee TELEGRAM_SEND_FAILED sans token).
  A4 « Vérifier l'utilisateur » : POST /api/telegram/autoriser
     (droits cote SafeLink) + repli admin TELEGRAM_ALLOWED_ID.
  A5 If « Accès vérifié ? » -> Generer / Refuser (motif inclus).
  A6 Generer : alphabet sans ambigus, 7 validations prealables,
     profil existe, idempotence runId (commentaire traceur), simulation
     sans ecriture, arret au 1er echec (quantite creee retournee),
     stocks avant/apres, resume complet.
  A7 If « Erreur de génération ? » -> « Signaler l'erreur » (terminal).
  A8 If « Mode simulation ? » -> « Fin simulation » (terminal, sans envoi).
  A9 onError continueErrorOutput sur les 7 envois natifs ->
     « Signaler l'échec Telegram » (terminal, token expurge).
  A10 Légende PDF + message Confirmer enrichis (routeur/date).

Ajouts seulement sur les branches modifiees ; Router et chaine
HTML->PDF->envoi inchanges. Rejouable (ancrages verifies).
Usage : python3 scripts/patch-workflow-telegram.py
"""

import json
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"


def une_fois(texte: str, ancre: str, remplacement: str, etiquette: str) -> str:
    n = texte.count(ancre)
    if n != 1:
        sys.exit(f"ECHEC {etiquette} : ancre trouvee {n} fois (attendu 1).")
    return texte.replace(ancre, remplacement)


AIGUILLER = """// Routage robuste des mises a jour Telegram : message, edited_message,
// callback_query (enveloppe body ou directe). Normalise le texte saisi
// (« 3 jours » -> 03-JOURS) : une saisie valide continue comme un clic,
// jamais de renvoi automatique vers l'aide.
// Resout le jeton du bot via /api/telegram/contexte (repli $env) sans
// jamais bloquer le routage.
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
var autoriseId = String(($env && $env.TELEGRAM_ALLOWED_ID) || '');
var admin = autoriseId !== '' && chatId === autoriseId;
// Jeton du bot (personnalise si connu, sinon $env central) : repli
// silencieux, le routage ne depend jamais de l'application.
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
var PROFILS = ['03-JOURS', '01-SEMAINE', '01-MOIS'];
var QUOTAS = [120, 240, 480, 500];
var NORMALISER_PROFIL = { '3 jours': '03-JOURS', '03 jours': '03-JOURS', '03-jours': '03-JOURS', '1 semaine': '01-SEMAINE', '01 semaine': '01-SEMAINE', '01-semaine': '01-SEMAINE', '1 mois': '01-MOIS', '01 mois': '01-MOIS', '01-mois': '01-MOIS' };
function normaliserProfil(t) {
  var bas = String(t || '').trim().toLowerCase().replace(/\\s+/g, ' ');
  if (NORMALISER_PROFIL[bas]) return NORMALISER_PROFIL[bas];
  var haut = String(t || '').trim().toUpperCase();
  if (PROFILS.indexOf(haut) !== -1) return haut;
  return null;
}
function normaliserQuantite(t) {
  var m = String(t || '').trim().match(/(\\d+)/);
  if (!m) return null;
  var q = parseInt(m[1], 10);
  return QUOTAS.indexOf(q) !== -1 ? q : null;
}
function base(extra) {
  var o = { chatId: chatId, userId: userId, admin: admin, telegramBotToken: jetonBot, source: source };
  if (extra) for (var k in extra) o[k] = extra[k];
  return [{ json: o }];
}
if (texte !== '' && (estCommande(texte, 'start') || estCommande(texte, 'tickets'))) return base({ route: 'askProfiles' });
if (donneesCallback && donneesCallback.indexOf('prof:') === 0) {
  var profil = donneesCallback.slice(5);
  if (PROFILS.indexOf(profil) === -1) return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });
  return base({ route: 'askQty', profile: profil, callbackQueryId: idRequeteCallback });
}
if (donneesCallback && donneesCallback.indexOf('qty:') === 0) {
  var morceaux = donneesCallback.slice(4).split(':');
  var pq = morceaux[0]; var qq = parseInt(morceaux[1], 10);
  if (PROFILS.indexOf(pq) === -1 || QUOTAS.indexOf(qq) === -1) return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });
  return base({ route: 'generate', profile: pq, qty: qq, callbackQueryId: idRequeteCallback });
}
if (texte !== '') {
  var pn = normaliserProfil(texte);
  if (pn) return base({ route: 'askQty', profile: pn });
  var qn = normaliserQuantite(texte);
  if (qn !== null) return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });
  if (texte.charAt(0) === '/') return base({ route: 'help' });
  return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });
}
return base({ route: 'help' });"""


def main() -> None:
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}

    for requis in ("Demarrer", "Aiguiller", "Router",
                   "Proposer les profils", "Proposer les quotas",
                   "Generer les tickets", "Refuser", "Aide",
                   "Preparer le HTML PDF", "Envoyer le PDF", "Confirmer"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")

    # --- A1 : Aiguiller réécrit ---
    noeuds["Aiguiller"]["parameters"]["jsCode"] = AIGUILLER

    # --- A2 : claviers natifs ---
    def bouton_texte(texte, data):
        return {"row": {"buttons": [
            {"text": texte, "additionalFields": {"callback_data": data}}]}}

    noeuds["Proposer les profils"]["parameters"] = {
        "chatId": "={{$json.chatId}}",
        "text": "Quel profil pour les tickets ?",
        "replyMarkup": "inlineKeyboard",
        "inlineKeyboard": {
            "rows": [
                bouton_texte("03-JOURS (3 jours)", "prof:03-JOURS"),
                bouton_texte("01-SEMAINE (7 jours)", "prof:01-SEMAINE"),
                bouton_texte("01-MOIS (30 jours)", "prof:01-MOIS"),
            ]
        },
    }
    noeuds["Proposer les quotas"]["parameters"] = {
        "chatId": "={{$json.chatId}}",
        "text": "={{'Profil ' + $json.profile + ' — combien de tickets ?'}}",
        "replyMarkup": "inlineKeyboard",
        "inlineKeyboard": {
            "rows": [
                {"row": {"buttons": [
                    {"text": "120", "additionalFields": {
                        "callback_data": "={{'qty:' + $json.profile + ':120'}}"}}]}},
                {"row": {"buttons": [
                    {"text": "240", "additionalFields": {
                        "callback_data": "={{'qty:' + $json.profile + ':240'}}"}}]}},
                {"row": {"buttons": [
                    {"text": "480", "additionalFields": {
                        "callback_data": "={{'qty:' + $json.profile + ':480'}}"}}]}},
                {"row": {"buttons": [
                    {"text": "500", "additionalFields": {
                        "callback_data": "={{'qty:' + $json.profile + ':500'}}"}}]}},
            ]
        },
    }

    # --- A3 : accusés de réception (answerCallbackQuery, jamais bloquant) ---
    def accuser(nom, texte_accuse):
        return {
            "parameters": {
                "jsCode": (
                    "// Accuse le clic (answerCallbackQuery) pour eteindre le\n"
                    "// sablier Telegram. Ne bloque jamais : sans callbackQueryId\n"
                    "// ou sans jeton, passe sans appeler. Erreur formatee sans\n"
                    "// token : {code, message, chatIdPresent, runId}.\n"
                    "var items = $input.all();\nvar out = [];\n"
                    "for (var k = 0; k < items.length; k++) {\n"
                    "  var e = items[k].json || {};\n"
                    "  var accuse = false; var erreurEnvoi = null;\n"
                    "  var cbid = (e.callbackQueryId === undefined || e.callbackQueryId === null) ? '' : String(e.callbackQueryId);\n"
                    "  if (cbid) {\n"
                    "    var jeton = String(e.telegramBotToken || (($env && $env.TELEGRAM_BOT_TOKEN) || ''));\n"
                    "    if (jeton) {\n"
                    "      try {\n"
                    "        await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/answerCallbackQuery', body: { callback_query_id: cbid, text: '" + texte_accuse + "', show_alert: false }, json: true, timeout: 15000 });\n"
                    "        accuse = true;\n"
                    "      } catch (err) {\n"
                    "        var m = String((err && err.message) || err).replace(/bot\\d+:[A-Za-z0-9_-]{10,}/g, 'bot***');\n"
                    "        erreurEnvoi = { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!e.chatId, runId: e.runId || null, detail: m.slice(0, 300) };\n"
                    "      }\n"
                    "    }\n"
                    "  }\n"
                    "  var suivi = {};\n"
                    "  for (var c in e) suivi[c] = e[c];\n"
                    "  suivi.accuseReception = accuse;\n"
                    "  if (erreurEnvoi) suivi.erreurEnvoi = erreurEnvoi;\n"
                    "  out.push({ json: suivi });\n"
                    "}\n"
                    "return out;"
                )
            },
            "id": str(uuid.uuid4()),
            "name": nom,
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [0, 0],
        }

    accuser_profil = accuser("Accuser le profil", "Profil sélectionné")
    accuser_profil["position"] = [560, 320]
    accuser_quantite = accuser("Accuser la quantité", "Quantité sélectionnée")
    accuser_quantite["position"] = [560, 560]
    donnees["nodes"].append(accuser_profil)
    donnees["nodes"].append(accuser_quantite)

    # --- A4 : vérification des droits côté SafeLink ---
    donnees["nodes"].append({
        "parameters": {
            "jsCode": (
                "// Droits cote SafeLink : chatId -> tenant, bot + routeur.\n"
                "// Repli admin global TELEGRAM_ALLOWED_ID (compatibilite).\n"
                "var items = $input.all();\nvar out = [];\n"
                "var secret = String(($env && $env.N8N_WEBHOOK_SECRET) || '');\n"
                "var appli = String(($env && $env.APP_URL) || '').replace(/\\/$/, '');\n"
                "var SIM = String(($env && $env.SIMULATION) || '').toLowerCase() === 'true';\n"
                "for (var k = 0; k < items.length; k++) {\n"
                "  var e = items[k].json || {};\n"
                "  var acces = { autorise: false, motif: 'Vérification impossible.' };\n"
                "  if (appli && secret) {\n"
                "    try {\n"
                "      var rep = await this.helpers.httpRequest({ method: 'POST', url: appli + '/api/telegram/autoriser', headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': secret }, body: { chatId: String(e.chatId || ''), profile: String(e.profile || ''), qty: Number(e.qty), simulation: (e.simulation === true || SIM) }, json: true, timeout: 15000 });\n"
                "      var d = (rep && rep.data) || {};\n"
                "      if (d.autorise === true) acces = { autorise: true, tenantId: d.tenantId, userId: d.userId, routerConnectionId: d.routerConnectionId, routeurNom: d.routeurNom, routerBaseUrl: d.routerBaseUrl, routerUser: d.routerUser, routerPassword: d.routerPassword, telegramBotToken: d.telegramBotToken, telegramMode: d.telegramMode, runId: d.runId, profile: d.profile, qty: d.qty };\n"
                "      else acces = { autorise: false, motif: String(d.motif || 'Accès refusé.') };\n"
                "    } catch (err) {\n"
                "      if (e.admin === true) acces = null;\n"
                "      else acces = { autorise: false, motif: 'Vérification impossible : ' + String((err && err.message) || err).slice(0, 200) };\n"
                "    }\n"
                "  }\n"
                "  if (acces === null) {\n"
                "    var slot = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');\n"
                "    acces = { autorise: true, admin: true, tenantId: 'admin', userId: 'admin', routerConnectionId: null, routeurNom: 'routeur principal', routerBaseUrl: String(($env && $env.ROUTEROS_BASE_URL) || ''), routerUser: String(($env && $env.ROUTEROS_USER) || ''), routerPassword: String(($env && $env.ROUTEROS_PASSWORD) || ''), telegramBotToken: '', telegramMode: 'central', runId: 'tg-admin-' + String(e.profile || '') + '-' + String(e.qty || '') + '-' + slot };\n"
                "  }\n"
                "  var mel = {};\n"
                "  for (var c in e) mel[c] = e[c];\n"
                "  for (var a in acces) mel[a] = acces[a];\n"
                "  mel.simulation = (e.simulation === true || SIM);\n"
                "  out.push({ json: mel });\n"
                "}\n"
                "return out;"
            )
        },
        "id": str(uuid.uuid4()),
        "name": "Vérifier l'utilisateur",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [800, 560],
    })

    # --- A5/A7/A8 : trois If ---
    def noeud_if(nom, expression, x, y):
        # Idiome eprouve (cf. Router/Switch existant) : comparaison
        # de chaines avec equals, jamais d'operation booleenne.
        return {
            "parameters": {
                "conditions": {
                    "boolean": [{"value1": expression, "operation": "equals",
                                 "value2": "oui"}],
                    "combinator": "and",
                    "options": {"caseSensitive": True, "leftValue": "",
                                "typeValidation": "strict", "version": 1},
                },
                "options": {},
            },
            "id": str(uuid.uuid4()),
            "name": nom,
            "type": "n8n-nodes-base.if",
            "typeVersion": 1,
            "position": [x, y],
        }

    donnees["nodes"].append(
        noeud_if("Accès vérifié ?",
                 "={{ $json.autorise === true ? 'oui' : 'non' }}",
                 1020, 560))
    donnees["nodes"].append(
        noeud_if("Erreur de génération ?",
                 "={{ $json.erreur ? 'oui' : 'non' }}", 1020, 800))
    donnees["nodes"].append(
        noeud_if("Mode simulation ?",
                 "={{ $json.simulation ? 'oui' : 'non' }}", 1240, 800))

    # --- A7/A8 : terminaux ---
    donnees["nodes"].append({
        "parameters": {
            "chatId": "={{$json.chatId}}",
            "text": "={{ '⚠️ Génération interrompue (run ' + $json.runId + ') : ' + $json.qty + ' créés sur ' + $json.demandees + ' demandés. Erreur : ' + $json.erreur }}",
            "additionalFields": {},
        },
        "id": str(uuid.uuid4()),
        "name": "Signaler l'erreur",
        "type": "n8n-nodes-base.telegram",
        "typeVersion": 1.2,
        "position": [1240, 640],
    })
    donnees["nodes"].append({
        "parameters": {
            "jsCode": (
                "// Fin de simulation : aucun ecrit RouterOS, aucun PDF envoye,\n"
                "// aucune impression, aucun message final. Retourne uniquement\n"
                "// le resultat du routage et de la validation.\n"
                "return $input.all().map(function (entree) {\n"
                "  var c = entree.json || {};\n"
                "  return { json: { simulation: true, route: 'simulation', chatId: c.chatId || null, profile: c.profile || null, qty: c.qty ?? c.demandees ?? null, runId: c.runId || null, validation: 'ok - aucune écriture', date: new Date().toISOString() } };\n"
                "});"
            )
        },
        "id": str(uuid.uuid4()),
        "name": "Fin simulation",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1460, 940],
    })
    donnees["nodes"].append({
        "parameters": {
            "jsCode": (
                "// Echec d'un envoi Telegram natif (400/403/chat not found) :\n"
                "// formatte sans jamais exposer le token.\n"
                "return $input.all().map(function (entree) {\n"
                "  var j = entree.json || {};\n"
                "  var brut = String((j.error && j.error.message) || j.message || 'envoi impossible');\n"
                "  var propre = brut.replace(/bot\\d+:[A-Za-z0-9_-]{10,}/g, 'bot***');\n"
                "  return { json: { code: 'TELEGRAM_SEND_FAILED', message: 'Impossible d\\u2019envoyer le message Telegram', chatIdPresent: !!j.chatId, runId: j.runId || null, detail: propre.slice(0, 300) } };\n"
                "});"
            )
        },
        "id": str(uuid.uuid4()),
        "name": "Signaler l'échec Telegram",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1900, 200],
    })

    # --- A6 : Generer, correctifs chirurgicaux (QRious conservé tel quel) ---
    generer = noeuds["Generer les tickets"]["parameters"]["jsCode"]
    generer = une_fois(
        generer,
        "const ALPH = 'abcdefghijklmnopqrstuvwxyz0123456789';",
        "const ALPH = '23456789abcdefghijkmnpqrstuvwxyz';",
        "A6 alphabet",
    )
    generer = une_fois(
        generer,
        "const base = String($env.ROUTEROS_BASE_URL || '').replace(/\\/$/, '');",
        "const premier = (items[0] && items[0].json) || {};\n"
        "const base = String(premier.routerBaseUrl || ($env && $env.ROUTEROS_BASE_URL) || '').replace(/\\/$/, '');",
        "A6 routeur-tenant",
    )
    generer = une_fois(
        generer,
        "const user = String($env.ROUTEROS_USER || '');",
        "const user = String(premier.routerUser || ($env && $env.ROUTEROS_USER) || '');",
        "A6 utilisateur-tenant",
    )
    generer = une_fois(
        generer,
        "const pass = String($env.ROUTEROS_PASSWORD || '');",
        "const pass = String(premier.routerPassword || ($env && $env.ROUTEROS_PASSWORD) || '');",
        "A6 passe-tenant",
    )
    generer = une_fois(
        generer,
        "const used = new Set((Array.isArray(existing) ? existing : []).map(u => String(u.name)));",
        "const used = new Set((Array.isArray(existing) ? existing : []).map(u => String(u.name)));\n"
        "const profs = await this.helpers.httpRequest({ method: 'GET', url: base + '/rest/ip/hotspot/user/profile', headers: { Authorization: auth, Accept: 'application/json' }, json: true, timeout: 30000 });\n"
        "const nomsProfils = new Set((Array.isArray(profs) ? profs : (profs.data || profs.results || [])).map(p => String(p && p.name)));",
        "A6 profils",
    )
    generer = une_fois(
        generer,
        "  const qty = Math.max(1, Math.min(500, parseInt(item.json.qty, 10) || 0));\n"
        "  const profile = String(item.json.profile || '');\n"
        "  const chatId = item.json.chatId;",
        "  const profile = String(item.json.profile || '');\n"
        "  const chatId = item.json.chatId;\n"
        "  const qtyBrut = parseInt(item.json.qty, 10);\n"
        "  const runIdItem = String(item.json.runId || '');\n"
        "  const simulationItem = item.json.simulation === true || String(($env && $env.SIMULATION) || '').toLowerCase() === 'true';\n"
        "  if (!profile) throw new Error('Profil manquant : génération impossible' + (runIdItem ? ' (runId ' + runIdItem + ')' : ''));\n"
        "  if ([120, 240, 480, 500].indexOf(qtyBrut) === -1) throw new Error('Quantité invalide (' + item.json.qty + ') : autorisées 120, 240, 480, 500' + (runIdItem ? ' (runId ' + runIdItem + ')' : ''));\n"
        "  if (chatId === undefined || chatId === null || String(chatId) === '') throw new Error('chatId manquant : impossible de répondre' + (runIdItem ? ' (runId ' + runIdItem + ')' : ''));\n"
        "  if (!runIdItem) throw new Error('runId manquant : idempotence impossible.');\n"
        "  if (!nomsProfils.has(profile)) throw new Error('Profil hotspot \"' + profile + '\" introuvable sur le routeur (runId ' + runIdItem + ').');\n"
        "  const qty = qtyBrut;",
        "A6 validations",
    )
    generer = une_fois(
        generer,
        "  const tickets = [];",
        "  const tickets = [];\n"
        "  let erreurLot = null;\n"
        "  const listeExistants = Array.isArray(existing) ? existing : [];\n"
        "  const estNeuf = function (u) { return String((u && u.profile) || '') === profile && (u && u.disabled) !== true && String((u && u.disabled) || '').toLowerCase() !== 'true' && ['0s', '00:00:00'].indexOf(String((u && u.uptime) || '0s').trim()) !== -1; };\n"
        "  const neufsAvant = listeExistants.filter(estNeuf).length;\n"
        "  const marqueur = 'runId:' + runIdItem;\n"
        "  const dejaFait = listeExistants.some(function (u) { return String((u && u.comment) || '').indexOf(marqueur) !== -1; });\n"
        "  if (dejaFait) { out.push({ json: { chatId: chatId, profile: profile, qty: 0, demandees: qty, routeurNom: String(item.json.routeurNom || ''), generatedAt: new Date().toISOString(), html: '', tickets: [], runId: runIdItem, stockAvant: neufsAvant, stockApres: neufsAvant, simulation: true, dejaVu: true, note: 'run déjà traité : tickets existants conservés, rien recréé' } }); continue; }\n"
        "  if (simulationItem) { out.push({ json: { chatId: chatId, profile: profile, qty: 0, demandees: qty, routeurNom: String(item.json.routeurNom || ''), generatedAt: new Date().toISOString(), html: 'simulation', tickets: [], runId: runIdItem, stockAvant: neufsAvant, stockApres: neufsAvant, simulation: true } }); continue; }",
        "A6 idempotence+simulation",
    )
    generer = une_fois(
        generer,
        "    await this.helpers.httpRequest({ method: 'PUT', url: base + '/rest/ip/hotspot/user', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body, json: true, timeout: 30000 });\n    tickets.push({ code });",
        "    try {\n"
        "      await this.helpers.httpRequest({ method: 'PUT', url: base + '/rest/ip/hotspot/user', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body, json: true, timeout: 30000 });\n"
        "    } catch (ePut) {\n"
        "      erreurLot = 'Échec création ticket ' + code + ' (' + (tickets.length + 1) + '/' + qty + ') : ' + String((ePut && ePut.message) || ePut).slice(0, 200) + ' — ' + tickets.length + ' ticket(s) déjà créé(s) (runId ' + runIdItem + ')';\n"
        "      break;\n"
        "    }\n"
        "    tickets.push({ code });",
        "A6 arret-premier-echec",
    )
    generer = une_fois(
        generer,
        "comment: 'tg-auto ' + new Date().toISOString()",
        "comment: 'tg-bot runId:' + runIdItem + ' ' + new Date().toISOString()",
        "A6 traceur",
    )
    generer = une_fois(
        generer,
        "  const generatedAt = new Date().toISOString();",
        "  let stockApres = null;\n"
        "  try {\n"
        "    const relu = await this.helpers.httpRequest({ method: 'GET', url: base + '/rest/ip/hotspot/user', headers: { Authorization: auth, Accept: 'application/json' }, json: true, timeout: 30000 });\n"
        "    const liste = Array.isArray(relu) ? relu : (relu.data || relu.results || []);\n"
        "    stockApres = liste.filter(estNeuf).length;\n"
        "  } catch (eApres) { stockApres = null; }\n"
        "  const generatedAt = new Date().toISOString();",
        "A6 stock-apres",
    )
    generer = une_fois(
        generer,
        "out.push({ json: { chatId, profile, qty: tickets.length, generatedAt, html } });",
        "out.push({ json: { chatId, profile, qty: tickets.length, demandees: qty, routeurNom: String(item.json.routeurNom || ''), generatedAt: generatedAt, html: html, tickets: tickets, runId: runIdItem, stockAvant: neufsAvant, stockApres: stockApres, simulation: simulationItem, callbackQueryId: item.json.callbackQueryId || null } });",
        "A6 sortie",
    )
    # Ajout conditionnel du champ erreur (quantité réellement créée conservée).
    generer = une_fois(
        generer,
        "callbackQueryId: item.json.callbackQueryId || null } });",
        "callbackQueryId: item.json.callbackQueryId || null, ...(erreurLot ? { erreur: erreurLot } : {}) } });",
        "A6 sortie-erreur",
    )
    noeuds["Generer les tickets"]["parameters"]["jsCode"] = generer

    # --- A10 : Refuser (motif), Confirmer (routeur+date) ---
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    refuser = noeuds["Refuser"]["parameters"]
    assert refuser.get("text") == "⛔ Accès non autorisé.", "A10 Refuser inattendu."
    refuser["text"] = "={{'⛔ Accès non autorisé.' + ($json.motif ? ' ' + $json.motif : '')}}"
    confirmer = noeuds["Confirmer"]["parameters"]
    confirmer["text"] = (
        "={{ '✅ ' + $('Preparer le HTML PDF').first().json.qty + '/' "
        "+ $('Preparer le HTML PDF').first().json.demandees + ' tickets (' "
        "+ $('Preparer le HTML PDF').first().json.profile + ') générés sur ' "
        "+ ($('Preparer le HTML PDF').first().json.routeurNom || 'le routeur') "
        "+ ' le ' + $('Preparer le HTML PDF').first().json.generatedAt + '.' }}"
    )

    # --- A9 : onError sur les envois natifs ---
    for envoi in ("Proposer les profils", "Proposer les quotas",
                  "Envoyer le PDF", "Confirmer", "Refuser", "Aide",
                  "Signaler l'erreur"):
        noeuds[envoi]["onError"] = "continueErrorOutput"

    # --- Connexions ---
    connexions = donnees["connections"]

    def brancher(source, sortie, cible):
        assert source in connexions, f"Connexion source inconnue : {source}."
        principale = connexions[source]["main"]
        assert len(principale) > sortie, f"Sortie {sortie} absente : {source}."
        principale[sortie] = [
            {"node": cible, "type": "main", "index": 0}]

    # Quantites -> Accuser le profil -> Proposer les quotas
    brancher("Router", 1, "Accuser le profil")
    connexions["Accuser le profil"] = {
        "main": [[{"node": "Proposer les quotas", "type": "main",
                   "index": 0}]]}
    # Generer -> Accuser la quantité -> Vérifier -> Accès ? -> Generer/Refuser
    brancher("Router", 2, "Accuser la quantité")
    connexions["Accuser la quantité"] = {
        "main": [[{"node": "Vérifier l'utilisateur", "type": "main",
                   "index": 0}]]}
    connexions["Vérifier l'utilisateur"] = {
        "main": [[{"node": "Accès vérifié ?", "type": "main", "index": 0}]]}
    connexions["Accès vérifié ?"] = {
        "main": [[{"node": "Generer les tickets", "type": "main",
                   "index": 0}],
                 [{"node": "Refuser", "type": "main", "index": 0}]]}
    # Generer -> Erreur ? -> Signaler / Simulation ? -> Fin / HTML
    brancher("Generer les tickets", 0, "Erreur de génération ?")
    connexions["Erreur de génération ?"] = {
        "main": [[{"node": "Signaler l'erreur", "type": "main", "index": 0}],
                 [{"node": "Mode simulation ?", "type": "main",
                   "index": 0}]]}
    connexions["Mode simulation ?"] = {
        "main": [[{"node": "Fin simulation", "type": "main", "index": 0}],
                 [{"node": "Preparer le HTML PDF", "type": "main",
                   "index": 0}]]}
    # Branches d'erreur des envois -> formateur terminal
    for envoi in ("Proposer les profils", "Proposer les quotas",
                  "Envoyer le PDF", "Confirmer", "Refuser", "Aide",
                  "Signaler l'erreur"):
        if envoi not in connexions:
            connexions[envoi] = {"main": [[]]}
        principale = connexions[envoi]["main"]
        while len(principale) < 2:
            principale.append([])
        assert principale[1] == [], f"Branche erreur existante : {envoi}."
        principale[1] = [
            {"node": "Signaler l'échec Telegram", "type": "main",
             "index": 0}]

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
    print("OK : dialogue Telegram corrigé (A1-A10).")
    print("Nodes : " + str(len(noms)))
    print("Sauvegarde : " + str(FICHIER) + "." + horodatage + ".bak")


if __name__ == "__main__":
    main()
