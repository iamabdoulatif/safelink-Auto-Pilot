#!/usr/bin/env python3
"""Rapport journalier des ventes + heure de vente relevée.

Deux changements, dans le prolongement de la branche « Rapport
des ventes » existante :

1. SUIVI (nouvelle branche, cycle de 15 minutes) : pour chaque
   zone dont le rapport est actif, le workflow lit les tickets
   utilisés sur RouterOS et n'envoie à l'application que
   l'empreinte SHA-256 de chaque code jamais vu. L'application
   mémorise la première heure où elle voit le ticket utilisé :
   c'est l'heure de vente, à 15 minutes près. Le code et le mot
   de passe du ticket ne quittent jamais le routeur.

2. RAPPORT (nodes existants enrichis) : « Calculer » rattache
   chaque vente à son heure relevée (à défaut, la date du lot,
   sans heure) et produit le détail ticket par ticket ;
   « Envoyer » expédie, sur WhatsApp comme sur Telegram, le
   texte de synthèse ET un document CSV : admin et gérant
   reçoivent toutes les ventes de la zone, chaque vendeur
   reçoit uniquement les siennes. Le cycle « journalier »
   (veille 00h à 00h, dû chaque jour) est créé côté application.

Modifications ciblées seulement, ancrages vérifiés, sauvegarde
horodatée. Usage : python3 scripts/n8n/patch-workflow-rapport-journalier.py
"""

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
FICHIER = RACINE / "n8n" / "workflows" / "workflow-mikhmon-patched.json"

CALCULER = r"""// Ventes de la période sur RouterOS : un ticket VENDU = ticket
// déjà utilisé (uptime > 0). Jour et heure de vente : le suivi
// de 15 minutes quand il connaît le ticket (empreinte SHA-256
// du code, cfg.ventesSuivi), sinon la date du lot (commentaire
// vc-<lot>-<date>), sans heure. Montant = prix du profil lu
// dans on-login, comme Mikhmon SF. Le code du ticket ne sert
// qu'à calculer son empreinte et à remplir sa ligne du CSV :
// aucun mot de passe ne transite ni n'est journalisé.
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
__SHA256__
var users = liste(await this.helpers.httpRequest({ method: 'GET', url: routeur.adresse + '/rest/ip/hotspot/user', headers: headers, json: true, timeout: 30000, skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String(($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1) }));
var profs = liste(await this.helpers.httpRequest({ method: 'GET', url: routeur.adresse + '/rest/ip/hotspot/user/profile', headers: headers, json: true, timeout: 30000, skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String(($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1) }));
var prix = {};
for (var p = 0; p < profs.length; p++) prix[String(profs[p].name)] = prixProfil(profs[p]['on-login']);
var debut = String((cfg.periode || {}).debut || '');
var fin = String((cfg.periode || {}).fin || '');
var lotVendeur = {};
for (var lv = 0; lv < (cfg.lotsVendeurs || []).length; lv++) lotVendeur[String(cfg.lotsVendeurs[lv].lot)] = String(cfg.lotsVendeurs[lv].numero_vendeur || cfg.lotsVendeurs[lv].numero || '');
var suiviParHash = {};
for (var sv = 0; sv < (cfg.ventesSuivi || []).length; sv++) { var s = cfg.ventesSuivi[sv]; if (s && s.ticketHash) suiviParHash[String(s.ticketHash)] = s; }
var neufs = {};
for (var n = 0; n < users.length; n++) {
  var nu = users[n];
  var desactive = nu.disabled === true || String(nu.disabled || '').toLowerCase() === 'true';
  if (!desactive && parseUptime(nu.uptime) <= 0) { var np = String(nu.profile || ''); neufs[np] = (neufs[np] || 0) + 1; }
}
var ventes = [];
for (var u = 0; u < users.length; u++) {
  var user = users[u];
  if (parseUptime(user.uptime) <= 0) continue;
  var profil = String(user.profile || '');
  var prixU = prix[profil] || 0;
  var mLot = String(user.comment || '').match(/vc-(\d+)-/);
  var lot = mLot ? mLot[1] : '';
  var hash = sha256hex(utf8Bytes(String(user.name || '')));
  var suivi = suiviParHash[hash];
  var jour = '';
  var heure = '';
  var connue = false;
  if (suivi && suivi.heureConnue && suivi.vuLe) { jour = String(suivi.vuLe).slice(0, 10); heure = String(suivi.vuLe).slice(11, 16); connue = true; }
  else { jour = dateDuLot(user.comment); }
  if (!jour || jour < debut || jour >= fin) continue;
  ventes.push({ ticket: String(user.name || ''), date: jour, heure: heure, heureConnue: connue, profil: profil, prix: prixU, lot: lot, vendeur: lotVendeur[lot] || '' });
}
ventes.sort(function (a, b) { var ka = a.date + ' ' + (a.heureConnue ? a.heure : '99:99') + ' ' + a.ticket; var kb = b.date + ' ' + (b.heureConnue ? b.heure : '99:99') + ' ' + b.ticket; return ka < kb ? -1 : (ka > kb ? 1 : 0); });
var parProfilMap = {};
var parVendeurMap = {};
var totalVendu = 0;
for (var v = 0; v < ventes.length; v++) {
  var vente = ventes[v];
  if (!parProfilMap[vente.profil]) parProfilMap[vente.profil] = { profil: vente.profil, tickets: 0, prixUnitaire: vente.prix, montant: 0 };
  parProfilMap[vente.profil].tickets += 1;
  parProfilMap[vente.profil].montant = parProfilMap[vente.profil].tickets * parProfilMap[vente.profil].prixUnitaire;
  totalVendu += vente.prix;
  if (vente.vendeur) { if (!parVendeurMap[vente.vendeur]) parVendeurMap[vente.vendeur] = { numero: vente.vendeur, tickets: 0, montant: 0 }; parVendeurMap[vente.vendeur].tickets += 1; parVendeurMap[vente.vendeur].montant += vente.prix; }
}
var appUrl = '';
try { appUrl = String((($('Signer la lecture rapport').first() || {}).json || {}).appUrl || ''); } catch (eApp) {}
var copie = {};
for (var k in cfg) copie[k] = cfg[k];
copie.appUrl = appUrl;
copie.ticketsVendus = ventes.length;
copie.totalVendu = totalVendu;
copie.ventes = ventes;
copie.ventesSansHeure = ventes.filter(function (x) { return !x.heureConnue; }).length;
copie.parProfil = Object.keys(parProfilMap).sort().map(function (nom) { var l = parProfilMap[nom]; l.reste = neufs[nom] || 0; return l; });
var avecVendeurs = String(routeur.variante || '') === 'sf-v1';
copie.parVendeur = (avecVendeurs ? Object.keys(parVendeurMap).sort() : []).map(function (nom) { return parVendeurMap[nom]; });
copie.montantFormate = fmt(totalVendu);
return [{ json: copie }];
"""

ENVOYER = r"""// Envoie le point des ventes, en TEXTE et en document CSV.
// Gérant et admin : total, détail par profil, CSV de toutes les
// ventes (ticket, heure de vente relevée, profil, prix,
// vendeur). Chaque vendeur (WhatsApp, variante SF) : ses seules
// ventes, en texte et en CSV. Telegram : rapport complet au
// chat de l'espace (message + document CSV). Les heures sont
// relevées toutes les 15 minutes ; « — » = ticket antérieur au
// suivi. Aucune erreur ne contient de secret.
const sorties = [];
for (const item of $input.all()) {
  const cfg = item.json || {};
  const zone = cfg.zone || {};
  const fmt = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';
  const debut = String((cfg.periode || {}).debut || '');
  const fin = String((cfg.periode || {}).fin || '');
  const journalier = debut !== '' && fin !== '' && (Date.parse(fin + 'T00:00:00Z') - Date.parse(debut + 'T00:00:00Z')) === 86400000;
  const titre = journalier ? '📊 Rapport journalier des ventes' : '📊 Rapport des ventes';
  const periode = journalier ? 'le ' + debut + ' (00h à 00h)' : 'du ' + debut + ' au ' + fin + ' (00h à 00h)';
  const ventes = Array.isArray(cfg.ventes) ? cfg.ventes : [];
  const enteteZone = titre + ' — ' + (zone.nom || 'Zone Wi-Fi')
    + (zone.localisation || zone.commune ? '\n📍 ' + [zone.localisation, zone.commune].filter(Boolean).join(', ') : '')
    + '\n🗓️ Période ' + periode;
  const detail = (cfg.parProfil || []).map((p) => '• ' + p.profil + ' : ' + p.tickets + ' vendus · ' + fmt(p.montant) + ' · reste ' + (p.reste ?? 0)).join('\n');
  const parVendeur = cfg.parVendeur || [];
  const detailVendeurs = parVendeur.map((v) => '• ' + v.numero + ' : ' + v.tickets + ' vendus · ' + fmt(v.montant)).join('\n');
  const noteHeure = cfg.ventesSansHeure ? '\n⏰ ' + cfg.ventesSansHeure + ' ticket(s) sans heure relevée (antérieurs au suivi de 15 min) : « — » dans le CSV.' : '';
  const texteGestion = enteteZone
    + '\n🎟️ Tickets vendus : ' + cfg.ticketsVendus
    + '\n💰 Total vendu : ' + fmt(cfg.totalVendu)
    + (detail ? '\n\nDétail par profil :\n' + detail : '\n\nAucune vente sur la période.')
    + (detailVendeurs ? '\n\nPar vendeur :\n' + detailVendeurs : '')
    + '\n\n🧾 Détail ticket par ticket (heure de vente relevée) : document CSV joint.' + noteHeure;
  const champ = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const ligne = (cols) => cols.map(champ).join(';');
  const construireCsv = (liste, avecReste) => {
    const lignes = [ligne(['ticket', 'date de vente', 'heure de vente', 'profil', 'prix unitaire (F)', 'vendeur'])];
    for (const v of liste) lignes.push(ligne([v.ticket, v.date, v.heure || '—', v.profil, v.prix, v.vendeur || '']));
    const resume = {};
    for (const v of liste) { if (!resume[v.profil]) resume[v.profil] = { tickets: 0, prixUnitaire: v.prix, montant: 0 }; resume[v.profil].tickets += 1; resume[v.profil].montant += v.prix; }
    const resteParProfil = {};
    for (const p of (cfg.parProfil || [])) resteParProfil[p.profil] = p.reste ?? 0;
    let total = 0;
    let nombre = 0;
    lignes.push('');
    lignes.push(ligne(['Résumé par profil']));
    lignes.push(ligne(['profil', 'tickets vendus', 'prix unitaire (F)', 'somme vendue (F)', 'reste en stock']));
    for (const nom of Object.keys(resume).sort()) { const r = resume[nom]; total += r.montant; nombre += r.tickets; lignes.push(ligne([nom, r.tickets, r.prixUnitaire, r.montant, avecReste ? (resteParProfil[nom] ?? 0) : ''])); }
    lignes.push(ligne(['TOTAL', nombre, '', total, '']));
    return '\ufeff' + lignes.join('\n') + '\n';
  };
  const nomCsv = 'rapport-ventes-' + debut + '.csv';
  const csvGestion = construireCsv(ventes, true);
  const compteur = { n: 0 };
  const envoyerDocWhatsApp = async (url, to, nomFichier, csv) => {
    compteur.n += 1;
    const limite = 'safelink' + Date.now() + compteur.n;
    const parties = [];
    const champSimple = (nom, valeur) => Buffer.from('--' + limite + '\r\nContent-Disposition: form-data; name="' + nom + '"\r\n\r\n' + valeur + '\r\n', 'utf8');
    parties.push(champSimple('to', to));
    parties.push(champSimple('filename', nomFichier));
    parties.push(Buffer.from('--' + limite + '\r\nContent-Disposition: form-data; name="file"; filename="' + nomFichier + '"\r\nContent-Type: text/csv\r\n\r\n', 'utf8'));
    parties.push(Buffer.from(csv, 'utf8'), Buffer.from('\r\n--' + limite + '--\r\n', 'utf8'));
    await this.helpers.httpRequest({ method: 'POST', url, headers: { 'Content-Type': 'multipart/form-data; boundary=' + limite }, body: Buffer.concat(parties), timeout: 60000 });
  };
  const envoyerDocTelegram = async (jeton, chat, nomFichier, csv, legende) => {
    compteur.n += 1;
    const limite = 'safelink' + Date.now() + compteur.n;
    const parties = [];
    const champSimple = (nom, valeur) => Buffer.from('--' + limite + '\r\nContent-Disposition: form-data; name="' + nom + '"\r\n\r\n' + valeur + '\r\n', 'utf8');
    parties.push(champSimple('chat_id', chat));
    parties.push(champSimple('caption', legende));
    parties.push(Buffer.from('--' + limite + '\r\nContent-Disposition: form-data; name="document"; filename="' + nomFichier + '"\r\nContent-Type: text/csv\r\n\r\n', 'utf8'));
    parties.push(Buffer.from(csv, 'utf8'), Buffer.from('\r\n--' + limite + '--\r\n', 'utf8'));
    await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendDocument', headers: { 'Content-Type': 'multipart/form-data; boundary=' + limite }, body: Buffer.concat(parties), timeout: 60000 });
  };
  const canal = String(cfg.canal || 'whatsapp');
  const canaux = cfg.canaux || {};
  let envois = 0;
  if (canal === 'telegram') {
    const jeton = String(canaux.telegramBotToken || '');
    const chat = String(canaux.telegramChatId || '');
    if (!jeton || !chat) throw new Error('Telegram non configuré pour le rapport.');
    await this.helpers.httpRequest({ method: 'POST', url: 'https://api.telegram.org/bot' + jeton + '/sendMessage', body: { chat_id: chat, text: texteGestion }, json: true, timeout: 30000 });
    await envoyerDocTelegram(jeton, chat, nomCsv, csvGestion, titre + ' — ' + (zone.nom || 'Zone Wi-Fi') + ' · ' + fmt(cfg.totalVendu));
    envois = 1;
  } else {
    const url = String(canaux.whatsappWebhookUrl || '');
    if (!url) throw new Error('Adaptateur WhatsApp non configuré pour le rapport.');
    const destinataires = [];
    const vus = new Set();
    const ajouter = (numero, texte, csv) => { const n = String(numero || '').trim(); if (n && !vus.has(n)) { vus.add(n); destinataires.push({ to: n, text: texte, csv }); } };
    ajouter(zone.numeroAdmin, texteGestion, csvGestion);
    if (String((cfg.routeur || {}).variante || '') === 'sf-v1') ajouter(zone.numeroGerant, texteGestion, csvGestion);
    if (String((cfg.routeur || {}).variante || '') === 'sf-v1') {
      for (const numeroBrut of (zone.numerosVendeurs || [])) {
        const numero = String(numeroBrut);
        const mesVentes = ventes.filter((v) => v.vendeur === numero);
        const monTotal = mesVentes.reduce((s, v) => s + v.prix, 0);
        const mesProfils = {};
        for (const v of mesVentes) { if (!mesProfils[v.profil]) mesProfils[v.profil] = { tickets: 0, montant: 0 }; mesProfils[v.profil].tickets += 1; mesProfils[v.profil].montant += v.prix; }
        const monDetail = Object.keys(mesProfils).sort().map((nom) => '• ' + nom + ' : ' + mesProfils[nom].tickets + ' vendus · ' + fmt(mesProfils[nom].montant)).join('\n');
        const texteVendeur = enteteZone
          + '\n🎟️ Vos tickets vendus : ' + mesVentes.length
          + '\n💰 Votre total : ' + fmt(monTotal)
          + (monDetail ? '\n\nVos ventes par profil :\n' + monDetail : '\n\nAucune vente sur la période.')
          + '\n\n🧾 Détail de vos tickets (heure de vente relevée) : document CSV joint.';
        ajouter(numero, texteVendeur, construireCsv(mesVentes, false));
      }
    }
    if (!destinataires.length) throw new Error('Aucun numéro de zone pour le rapport.');
    for (const d of destinataires) {
      await this.helpers.httpRequest({ method: 'POST', url, body: { to: d.to, text: d.text, message: d.text }, json: true, timeout: 30000 });
      await envoyerDocWhatsApp(url, d.to, nomCsv, d.csv);
      envois += 1;
    }
  }
  sorties.push({ json: { ...cfg, rapportEnvois: envois } });
}
return sorties;
"""

RELEVER = r"""// Relevé de 15 minutes : tickets déjà utilisés sur RouterOS.
// Pour chacun, seule l'empreinte SHA-256 du code part vers
// l'application, avec le profil, le lot et la date du lot : le
// code et le mot de passe ne quittent jamais le routeur.
var cfg = (($input.first() || {}).json || {}).data || {};
var routeur = cfg.routeur || {};
if (!routeur.adresse || !routeur.motDePasse) throw new Error('Configuration suivi incomplète.');
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
__SHA256__
var users = liste(await this.helpers.httpRequest({ method: 'GET', url: routeur.adresse + '/rest/ip/hotspot/user', headers: headers, json: true, timeout: 30000, skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String(($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1) }));
var tickets = [];
for (var u = 0; u < users.length; u++) {
  var user = users[u];
  if (parseUptime(user.uptime) <= 0) continue;
  var mLot = String(user.comment || '').match(/vc-(\d+)-/);
  tickets.push({ hash: sha256hex(utf8Bytes(String(user.name || ''))), profil: String(user.profile || ''), lot: mLot ? parseInt(mLot[1], 10) : null, lotDate: dateDuLot(user.comment) || null });
}
var appUrl = '';
try { appUrl = String((($('Signer la demande suivi').first() || {}).json || {}).appUrl || ''); } catch (eApp) {}
return [{ json: { tenantId: String(cfg.tenantId || ''), routerConnectionId: Number(cfg.routerConnectionId || 0), appUrl: appUrl, tickets: tickets } }];
"""

FRACTIONNER_SUIVI = r"""var entree = ($input.first() || {}).json || {};
var donnees = entree.data || {};
var zones = Array.isArray(donnees.zones) ? donnees.zones : [];
var appUrl = '';
try { appUrl = ($("Signer l'appel suivi des ventes").first().json || {}).appUrl || ''; } catch (e) { throw new Error('Rafale suivi introuvable.'); }
return zones.map(function (z) { return { json: { tenantId: String(z.tenantId || ''), routerConnectionId: Number(z.routerConnectionId || 0), appUrl: appUrl } }; });
"""


def main():
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    for requis in ("Contrôle périodique (15 min)", "Signer l'appel jobs",
                   "Calculer le rapport des ventes",
                   "Envoyer le rapport des ventes"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")
    if "Signer l'appel suivi des ventes" in noeuds:
        sys.exit("ECHEC : branche suivi des ventes déjà présente.")
    calculer_actuel = noeuds["Calculer le rapport des ventes"]["parameters"]["jsCode"]
    if "ventesSuivi" in calculer_actuel:
        sys.exit("ECHEC : détail journalier déjà présent dans « Calculer ».")

    # Fonctions SHA-256/UTF-8 recopiées depuis le node signataire
    # existant : même implémentation éprouvée, jamais réinventée.
    signer_jobs = noeuds["Signer l'appel jobs"]["parameters"]["jsCode"]
    debut_sha = signer_jobs.index("function sha256hex")
    fin_sha = signer_jobs.index("function hmacHex")
    sha_js = signer_jobs[debut_sha:fin_sha].rstrip() + "\n"
    assert "function utf8Bytes" in sha_js

    # Signataire de la rafale suivi : même patron que les rapports.
    signer_suivi = signer_jobs.replace(
        "canon({ simulation: simulation, horodatage: horodatage, rafale: rafale })",
        "canon({ suiviVentes: true, horodatage: horodatage, rafale: rafale })")
    assert signer_suivi != signer_jobs

    marque = "// Compte rendu signe"
    prefixe = signer_jobs[:signer_jobs.index(marque)]
    signer_demande = prefixe + r"""var secretInterne = (($env && $env.N8N_CALLBACK_SECRET) || '');
if (!secretInterne) throw new Error('N8N_CALLBACK_SECRET manquant.');
return $input.all().map(function (entree, i) {
  var z = entree.json || {};
  if (!z.tenantId || !z.routerConnectionId) throw new Error('Zone de suivi incomplète.');
  var horodatage = String(Date.now());
  var rafale = 'suivi-' + horodatage + '-' + i;
  var texte = canon({ tenantId: String(z.tenantId), routerConnectionId: Number(z.routerConnectionId), horodatage: horodatage, rafale: rafale });
  return { json: { corps: texte, signature: hmacHex(secretInterne, texte), horodatage: horodatage, rafale: rafale, appUrl: String(z.appUrl || '') } };
});
"""
    signer_enregistrement = prefixe + r"""var secretInterne = (($env && $env.N8N_CALLBACK_SECRET) || '');
if (!secretInterne) throw new Error('N8N_CALLBACK_SECRET manquant.');
return $input.all().map(function (entree, i) {
  var r = entree.json || {};
  if (!r.tenantId || !r.routerConnectionId) throw new Error('Relevé sans zone.');
  var horodatage = String(Date.now());
  var rafale = 'ventes-' + horodatage + '-' + i;
  var texte = canon({ tenantId: String(r.tenantId), routerConnectionId: Number(r.routerConnectionId), tickets: r.tickets || [], horodatage: horodatage, rafale: rafale });
  return { json: { corps: texte, signature: hmacHex(secretInterne, texte), horodatage: horodatage, rafale: rafale, appUrl: String(r.appUrl || '') } };
});
"""

    def code(nom, js, x, y, ident):
        return {"parameters": {"jsCode": js}, "id": ident, "name": nom,
                "type": "n8n-nodes-base.code", "typeVersion": 2,
                "position": [x, y]}

    def http(nom, url, x, y, ident):
        return {
            "parameters": {
                "method": "POST",
                "url": url,
                "sendBody": True, "specifyBody": "json",
                "jsonBody": "={{$json.corps}}", "sendHeaders": True,
                "headerParameters": {"parameters": [
                    {"name": "X-Signature", "value": "={{$json.signature}}"},
                    {"name": "X-Timestamp", "value": "={{$json.horodatage}}"},
                    {"name": "X-Run-Id", "value": "={{$json.rafale}}"}]},
                "options": {"timeout": 15000},
            },
            "id": ident, "name": nom,
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": [x, y],
        }

    # 1) Détail ticket par ticket + CSV dans les nodes existants.
    noeuds["Calculer le rapport des ventes"]["parameters"]["jsCode"] = \
        CALCULER.replace("__SHA256__", sha_js)
    noeuds["Envoyer le rapport des ventes"]["parameters"]["jsCode"] = ENVOYER

    # 2) Branche suivi des ventes (relevé de 15 minutes).
    donnees["nodes"].extend([
        code("Signer l'appel suivi des ventes", signer_suivi, 304, 880,
             "a2300001-0001-4001-8001-000000000011"),
        http("Récupérer les zones à relever",
             "={{$json.appUrl}}/api/internal/n8n/ventes/jobs", 432, 880,
             "a2300002-0002-4002-8002-000000000012"),
        code("Fractionner les zones à relever", FRACTIONNER_SUIVI, 560, 880,
             "a2300003-0003-4003-8003-000000000013"),
        code("Signer la demande suivi", signer_demande, 688, 880,
             "a2300004-0004-4004-8004-000000000014"),
        http("Lire la configuration suivi",
             "={{$json.appUrl}}/api/internal/n8n/ventes/configuration",
             816, 880, "a2300005-0005-4005-8005-000000000015"),
        code("Relever les tickets utilisés",
             RELEVER.replace("__SHA256__", sha_js), 944, 880,
             "a2300006-0006-4006-8006-000000000016"),
        code("Signer l'enregistrement des ventes", signer_enregistrement,
             1072, 880, "a2300007-0007-4007-8007-000000000017"),
        http("Enregistrer les premières utilisations",
             "={{$json.appUrl}}/api/internal/n8n/ventes/enregistrer",
             1200, 880, "a2300008-0008-4008-8008-000000000018"),
    ])

    connexions = donnees["connections"]
    controle = connexions["Contrôle périodique (15 min)"]["main"][0]
    controle.append({"node": "Signer l'appel suivi des ventes",
                     "type": "main", "index": 0})
    chaine = [
        ("Signer l'appel suivi des ventes", "Récupérer les zones à relever"),
        ("Récupérer les zones à relever", "Fractionner les zones à relever"),
        ("Fractionner les zones à relever", "Signer la demande suivi"),
        ("Signer la demande suivi", "Lire la configuration suivi"),
        ("Lire la configuration suivi", "Relever les tickets utilisés"),
        ("Relever les tickets utilisés", "Signer l'enregistrement des ventes"),
        ("Signer l'enregistrement des ventes",
         "Enregistrer les premières utilisations"),
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
    print("OK : rapport journalier + suivi des ventes ajoutés.")
    print("Nodes : " + str(len(noms)))


if __name__ == "__main__":
    main()
