#!/usr/bin/env python3
"""Vague 2 du dialogue Telegram autonome (workflow-telegram-tickets.json).

Applique sur le JSON deja corrige par la vague 1 (ne restaure PAS le
.bak : ajouts seulement sur l'etat courant) :

  B1 Titre « Proposer les profils » avec emoji + 3 boutons natifs.
  B2 « Proposer les quotas » : 2 rangees x 2 boutons emoji, callbacks
     dynamiques quần profil (n8n 2.45.7 : replyMarkup natif, jamais
     additionalFields.reply_markup).
  B3 Aiguiller : quantite saisie seule (« 120 ») reconnue mais sans
     profil -> route help + errorCode QUANTITE_SANS_PROFIL (jamais de
     generation sans profil ; la generation exige profile+callback).
  B4 Aide : texte adaptatif (QUANTITE_SANS_PROFIL guide vers un profil,
     sinon texte habituel). Aucun reply_markup sur les envois texte.
  B5 Accuses : en cas d'echec answerCallbackQuery, 2e essai best-effort
     avec message d'erreur court (« Erreur, réessayez. »), jamais
     bloquant, token expurge.
  B6 Generer : limit-uptime / limit-bytes-total ajoutes au PUT seulement
     si configures (via autoriser, env LIMIT_UPTIME/LIMIT_BYTES_TOTAL) ;
     tenantId propage dans les 3 sorties (succes/simulation/dejaVu).
  B7 Verifier : fusionne limitUptime/limitBytesTotal du contexte.
  B8 Nouveau node « Notifier SafeLink » : POST /api/n8n/retour signe
     HMAC-SHA256 du corps brut (x-signature, SHA-256 reimplemente sans
     module), statut termine/echoue + quantites + stocks + runId.
     Simulation = aucun appel. Ne leve jamais.
  B9 Cablage : Confirmer -> Notifier ; Signaler l'erreur -> Notifier.

Rejouable une fois (ancres sur l'etat vague 1).
Usage : python3 scripts/patch-workflow-telegram-2.py
"""

import json
import shutil
import sys
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-telegram-tickets.json"


def une_fois(texte: str, ancre: str, remplacement: str, etiquette: str) -> str:
    n = texte.count(ancre)
    if n != 1:
        sys.exit(f"ECHEC {etiquette} : ancre trouvee {n} fois (attendu 1).")
    return texte.replace(ancre, remplacement)


def remplacer_tout(texte: str, ancre: str, remplacement: str,
                   attendu: int, etiquette: str) -> str:
    n = texte.count(ancre)
    if n != attendu:
        sys.exit(f"ECHEC {etiquette} : ancre trouvee {n} fois "
                 f"(attendu {attendu}).")
    return texte.replace(ancre, remplacement)


NOTIFIER_JS = """// Notifie SafeLink (/api/n8n/retour) : statut + quantites + stocks,
// sans mot de passe de ticket. Signature HMAC-SHA256 du corps brut
// (en-tete x-signature), SHA-256 reimplemente ici sans module externe.
// Simulation = aucun appel. Ne leve jamais : un echec est enregistre.
function utf8(s) {
  var b = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 128) b.push(c);
    else if (c < 2048) b.push(192 | (c >> 6), 128 | (c & 63));
    else if (c >= 55296 && c < 57344 && i + 1 < s.length) {
      var d = s.charCodeAt(i + 1);
      if (d >= 56320 && d < 57344) {
        c = 65536 + ((c - 55296) << 10) + (d - 56320);
        b.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
        i++;
      } else b.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    } else b.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  return b;
}
var K256 = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256octets(msg) {
  var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var bitLen = msg.length * 8;
  var bytes = msg.slice();
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  var hi = Math.floor(bitLen / 4294967296);
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);
  function r(x, n) { return (x >>> n) | (x << (32 - n)); }
  var W = new Array(64);
  for (var off2 = 0; off2 < bytes.length; off2 += 64) {
    for (var i = 0; i < 16; i++) W[i] = ((bytes[off2 + i * 4] << 24) | (bytes[off2 + i * 4 + 1] << 16) | (bytes[off2 + i * 4 + 2] << 8) | bytes[off2 + i * 4 + 3]) >>> 0;
    for (var i = 16; i < 64; i++) {
      var s0 = (r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3)) >>> 0;
      var s1 = (r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10)) >>> 0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (var i = 0; i < 64; i++) {
      var S1 = (r(e, 6) ^ r(e, 11) ^ r(e, 25)) >>> 0;
      var ch = ((e & f) ^ ((~e) & g)) >>> 0;
      var t1 = (h + S1 + ch + K256[i] + W[i]) >>> 0;
      var S0 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) >>> 0;
      var mj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      var t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  var o = [];
  for (var k = 0; k < 8; k++) o.push((H[k] >>> 24) & 255, (H[k] >>> 16) & 255, (H[k] >>> 8) & 255, H[k] & 255);
  return o;
}
function hex(oct) {
  var s = '';
  for (var i = 0; i < oct.length; i++) { var h = oct[i].toString(16); s += h.length < 2 ? '0' + h : h; }
  return s;
}
function hmac256hex(cle, texte) {
  var kb = utf8(cle);
  if (kb.length > 64) kb = sha256octets(kb);
  while (kb.length < 64) kb.push(0);
  var ip = [], op = [];
  for (var i = 0; i < 64; i++) { ip.push(kb[i] ^ 0x36); op.push(kb[i] ^ 0x5c); }
  return hex(sha256octets(op.concat(sha256octets(ip.concat(utf8(texte))))));
}
var items = $input.all();
var out = [];
var appli = String(($env && $env.APP_URL) || '').replace(/\\/$/, '');
var secret = String(($env && $env.N8N_CALLBACK_SECRET) || '');
for (var k = 0; k < items.length; k++) {
  var e = items[k].json || {};
  var suivi = {};
  for (var c in e) suivi[c] = e[c];
  suivi.notificationSafelik = 'ignoree';
  var rapport = { tenantId: e.tenantId || null, runId: e.runId || null, statut: e.erreur ? 'echoue' : 'termine', quantiteCreee: (typeof e.qty === 'number' ? e.qty : 0), stockAvant: (typeof e.stockAvant === 'number' ? e.stockAvant : null), stockApres: (typeof e.stockApres === 'number' ? e.stockApres : null) };
  if (e.erreur) rapport.erreur = String(e.erreur).slice(0, 500);
  if (!e.simulation && appli && secret && rapport.tenantId && rapport.runId) {
    try {
      var brut = JSON.stringify(rapport);
      var sig = hmac256hex(secret, brut);
      await this.helpers.httpRequest({ method: 'POST', url: appli + '/api/n8n/retour', headers: { 'Content-Type': 'application/json', 'x-signature': sig }, body: JSON.parse(brut), json: true, timeout: 15000 });
      suivi.notificationSafelik = 'envoyee';
    } catch (err) {
      suivi.notificationSafelik = 'echec';
    }
  }
  out.push({ json: suivi });
}
return out;
"""


def main() -> None:
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    for requis in ("Aiguiller", "Proposer les profils",
                   "Proposer les quotas", "Aide",
                   "Accuser le profil", "Accuser la quantité",
                   "Generer les tickets", "Vérifier l'utilisateur",
                   "Confirmer", "Signaler l'erreur"):
        assert requis in noeuds, f"Node manquant (vague 1 requise) : {requis}."
    assert "Notifier SafeLink" not in noeuds, "Vague 2 deja appliquee."

    # --- B1 : titre emoji profils ---
    profils = noeuds["Proposer les profils"]["parameters"]
    assert profils.get("text") == "Quel profil pour les tickets ?", \
        "B1 titre inattendu."
    assert "reply_markup" not in json.dumps(profils), "B1 reply_markup."
    profils["text"] = "🎟️ Quel profil pour les tickets ?"

    # --- B2 : quotas 2x2 emoji, callbacks dynamiques ---
    quotas = noeuds["Proposer les quotas"]["parameters"]
    rangees = quotas.get("inlineKeyboard", {}).get("rows", [])
    assert len(rangees) == 4, "B2 forme inattendue."

    def bouton_texte(texte, data):
        return {"row": {"buttons": [
            {"text": texte, "additionalFields": {"callback_data": data}}]}}

    quotas["inlineKeyboard"] = {
        "rows": [
            {"row": {"buttons": [
                {"text": "🎟️ 120", "additionalFields": {
                    "callback_data": "={{'qty:' + $json.profile + ':120'}}"}},
                {"text": "🎟️ 240", "additionalFields": {
                    "callback_data": "={{'qty:' + $json.profile + ':240'}}"}},
            ]}},
            {"row": {"buttons": [
                {"text": "🎟️ 480", "additionalFields": {
                    "callback_data": "={{'qty:' + $json.profile + ':480'}}"}},
                {"text": "🎟️ 500", "additionalFields": {
                    "callback_data": "={{'qty:' + $json.profile + ':500'}}"}},
            ]}},
        ]
    }
    quotas["replyMarkup"] = "inlineKeyboard"

    # --- B3 : quantite solitaire reconnue, jamais generee sans profil ---
    aiguiller = noeuds["Aiguiller"]["parameters"]["jsCode"]
    aiguiller = une_fois(
        aiguiller,
        "  if (qn !== null) return base({ route: 'help', errorCode: 'INPUT_INVALIDE' });",
        "  if (qn !== null) return base({ route: 'help', errorCode: 'QUANTITE_SANS_PROFIL', qty: qn });",
        "B3 quantite solitaire",
    )
    noeuds["Aiguiller"]["parameters"]["jsCode"] = aiguiller

    # --- B4 : Aide adaptative, sans reply_markup ---
    aide_node = noeuds["Aide"]["parameters"]
    assert aide_node.get("text", "").startswith("Envoyez /tickets"), \
        "B4 aide inattendue."
    assert "reply_markup" not in json.dumps(aide_node), "B4 reply_markup."
    aide_node["text"] = (
        "={{ $json.errorCode === 'QUANTITE_SANS_PROFIL' "
        "? 'Quantité ' + $json.qty + ' reçue : touchez d\\u2019abord un "
        "profil (03-JOURS, 01-SEMAINE, 01-MOIS), puis la quantité.' "
        ": 'Envoyez /tickets pour générer des tickets Wi-Fi. — Profils "
        "payants uniquement (default exclu), 120 / 240 / 480 / 500.' }}"
    )

    # --- B5 : 2e essai best-effort en cas d'echec d'accuse ---
    for nom in ("Accuser le profil", "Accuser la quantité"):
        js = noeuds[nom]["parameters"]["jsCode"]
        js = remplacer_tout(
            js,
            "      } catch (err) {\n"
            "        var m = String((err && err.message) || err)",
            "      } catch (err) {\n"
            "        try {\n"
            "          await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/answerCallbackQuery', body: { callback_query_id: cbid, text: 'Erreur, réessayez.', show_alert: false }, json: true, timeout: 8000 });\n"
            "        } catch (e2) { void e2; }\n"
            "        var m = String((err && err.message) || err)",
            1, "B5 " + nom,
        )
        noeuds[nom]["parameters"]["jsCode"] = js

    # --- B6 : limites optionnelles + tenantId dans Generer ---
    generer = noeuds["Generer les tickets"]["parameters"]["jsCode"]
    generer = une_fois(
        generer,
        "  const runIdItem = String(item.json.runId || '');",
        "  const runIdItem = String(item.json.runId || '');\n"
        "  const limiteDuree = String(item.json.limitUptime || '');\n"
        "  const limiteVolume = String(item.json.limitBytesTotal || '');",
        "B6 limites",
    )
    generer = une_fois(
        generer,
        "const body = { name: code, password: code, profile, server: 'all', comment: 'tg-bot runId:' + runIdItem + ' ' + new Date().toISOString() };",
        "const body = { name: code, password: code, profile, server: 'all', comment: 'tg-bot runId:' + runIdItem + ' ' + new Date().toISOString(), ...(limiteDuree ? { 'limit-uptime': limiteDuree } : {}), ...(limiteVolume ? { 'limit-bytes-total': limiteVolume } : {}) };",
        "B6 corps",
    )
    generer = une_fois(
        generer,
        "simulation: true, dejaVu: true",
        "tenantId: (item.json.tenantId || null), simulation: true, dejaVu: true",
        "B6 tenant-dejaVu",
    )
    generer = une_fois(
        generer,
        "stockAvant: neufsAvant, stockApres: neufsAvant, simulation: true } });",
        "tenantId: (item.json.tenantId || null), stockAvant: neufsAvant, stockApres: neufsAvant, simulation: true } });",
        "B6 tenant-simulation",
    )
    generer = une_fois(
        generer,
        "callbackQueryId: item.json.callbackQueryId || null, ...(erreurLot",
        "tenantId: (item.json.tenantId || null), callbackQueryId: item.json.callbackQueryId || null, ...(erreurLot",
        "B6 tenant-succes",
    )
    noeuds["Generer les tickets"]["parameters"]["jsCode"] = generer

    # --- B7 : Verifier fusionne les limites ---
    verifier = noeuds["Vérifier l'utilisateur"]["parameters"]["jsCode"]
    verifier = une_fois(
        verifier,
        "runId: d.runId, profile: d.profile, qty: d.qty };",
        "runId: d.runId, profile: d.profile, qty: d.qty, limitUptime: (d.limitUptime || ''), limitBytesTotal: (d.limitBytesTotal || '') };",
        "B7 limites",
    )
    noeuds["Vérifier l'utilisateur"]["parameters"]["jsCode"] = verifier

    # --- B8/B9 : Notifier SafeLink + cablage ---
    donnees["nodes"].append({
        "parameters": {"jsCode": NOTIFIER_JS},
        "id": str(uuid.uuid4()),
        "name": "Notifier SafeLink",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1900, 400],
    })
    connexions = donnees["connections"]
    for source in ("Confirmer", "Signaler l'erreur"):
        assert source in connexions, f"B9 source inconnue : {source}."
        principale = connexions[source]["main"]
        assert principale and principale[0] == [], \
            f"B9 sortie existante : {source}."
        principale[0] = [
            {"node": "Notifier SafeLink", "type": "main", "index": 0}]

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

    shutil.copyfile(FICHIER, str(FICHIER) + ".pre-v2.bak")
    FICHIER.write_text(json.dumps(donnees, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    print("OK : vague 2 appliquée (B1-B9).")
    print("Nodes : " + str(len(noms)))


if __name__ == "__main__":
    main()
