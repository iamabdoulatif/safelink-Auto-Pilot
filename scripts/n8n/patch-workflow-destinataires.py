#!/usr/bin/env python3
"""Envoi du PDF aux autres destinataires d'une regle (idempotent).

Le node passe avant le canal principal, y compris pour un PDF a telecharger.
Un echec ne bloque jamais le lot : il remonte comme avertissement sur la regle.
Utilisation : python3 scripts/n8n/patch-workflow-destinataires.py
"""
import json
from pathlib import Path

CHEMIN = (Path(__file__).resolve().parent.parent.parent
          / "n8n" / "workflows" / "workflow-mikhmon-patched.json")
NOM = "Envoyer aux autres destinataires"

CODE = r"""// Envoie le PDF deja cree aux autres destinataires de la regle. Une erreur ne
// bloque ni le canal principal ni le compte rendu, et ne contient jamais l'URL
// de Telegram, qui porte le jeton du bot.
const items = $input.all();
const sorties = [];
for (let i = 0; i < items.length; i++) {
  const cfg = items[i].json;
  const liste = Array.isArray(cfg.destinatairesSupplementaires) ? cfg.destinatairesSupplementaires : [];
  const echecs = [];
  let pdf = null;
  for (const d of liste) {
    try {
      if (!d.url) throw new Error('canal non configure');
      if (!pdf) pdf = await this.helpers.getBinaryDataBuffer(i, 'data');
      const telegram = d.canal === 'telegram';
      const champs = telegram
        ? { chat_id: d.destinataire, caption: '🎟️ Tickets Wi-Fi générés\n\n📡 Routeur : ' + (cfg.routeurNom || cfg.routerBaseUrl || 'Routeur') + '\n👤 Profil : ' + (cfg.profile || '-') + '\n✅ Tickets créés : ' + (cfg.generatedCount ?? 0) + '\n📦 Stock : ' + (cfg.stockAvant ?? '—') + ' → ' + (cfg.stockApres ?? '—') + (cfg.generatedAt ? '\n🕐 ' + String(cfg.generatedAt).slice(8, 10) + '/' + String(cfg.generatedAt).slice(5, 7) + '/' + String(cfg.generatedAt).slice(0, 4) + ' à ' + String(cfg.generatedAt).slice(11, 16) + ' UTC' : '') }
        : { to: d.destinataire, filename: 'tickets-mikhmon.pdf' };
      const limite = 'safelink' + Date.now() + i;
      const parties = Object.keys(champs).map((c) => Buffer.from('--' + limite + '\r\nContent-Disposition: form-data; name="' + c + '"\r\n\r\n' + champs[c] + '\r\n', 'utf8'));
      parties.push(Buffer.from('--' + limite + '\r\nContent-Disposition: form-data; name="' + (telegram ? 'document' : 'file') + '"; filename="tickets-mikhmon.pdf"\r\nContent-Type: application/pdf\r\n\r\n', 'utf8'));
      parties.push(pdf, Buffer.from('\r\n--' + limite + '--\r\n', 'utf8'));
      await this.helpers.httpRequest({ method: 'POST', url: d.url, headers: { 'Content-Type': 'multipart/form-data; boundary=' + limite }, body: Buffer.concat(parties), timeout: 60000 });
    } catch (e) {
      echecs.push(d.canal + ' ' + d.destinataire);
    }
  }
  sorties.push({
    json: { ...cfg, destinatairesSupplementaires: [], avertissementEnvoi: echecs.length ? 'Envoi non abouti pour : ' + echecs.join(', ') + '.' : '' },
    binary: items[i].binary,
    pairedItem: { item: i },
  });
}
return sorties;
"""


def remplacer(code, ancien, nouveau):
    if nouveau in code:
        return code
    assert ancien in code, ancien
    return code.replace(ancien, nouveau, 1)


doc = json.loads(CHEMIN.read_text(encoding="utf-8"))
noeuds = {n["name"]: n for n in doc["nodes"]}

p = noeuds["Paramètres Mikhmon"]["parameters"]
p["jsCode"] = remplacer(
    p["jsCode"],
    "  input.nomTicket = routeurJob.nomTicket || '';",
    "  input.nomTicket = routeurJob.nomTicket || '';\n"
    "  input.destinatairesSupplementaires = livraisonJob.supplementaires || [];",
)
p["jsCode"] = remplacer(
    p["jsCode"],
    "  nomTicket: String(input.nomTicket || ''),",
    "  nomTicket: String(input.nomTicket || ''),\n"
    "  destinatairesSupplementaires: Array.isArray(input.destinatairesSupplementaires) ? input.destinatairesSupplementaires : [],",
)

r = noeuds["Préparer le retour signé"]["parameters"]
r["jsCode"] = remplacer(
    r["jsCode"],
    "    if (errAuto) contenuAuto.erreur = String(errAuto).slice(0, 500);",
    "    if (errAuto) contenuAuto.erreur = String(errAuto).slice(0, 500);\n"
    "    if (!errAuto && cfg.avertissementEnvoi) contenuAuto.avertissement = String(cfg.avertissementEnvoi).slice(0, 500);",
)

c = noeuds["Clôturer l'envoi"]["parameters"]
c["jsCode"] = c["jsCode"].replace("$('Rattacher la config au PDF')", "$('" + NOM + "')")

source = noeuds["Rattacher la config au PDF"]
if NOM in noeuds:
    noeuds[NOM]["parameters"]["jsCode"] = CODE
else:
    x, y = source["position"]
    doc["nodes"].append({
        "id": "b7c1f2d4-6a3e-4c58-9e17-2d8f5a7c9b31",
        "name": NOM,
        "type": "n8n-nodes-base.code",
        "typeVersion": source["typeVersion"],
        "position": [x + 120, y + 180],
        "parameters": {"jsCode": CODE},
    })
doc["connections"]["Rattacher la config au PDF"] = {
    "main": [[{"node": NOM, "type": "main", "index": 0}]]
}
doc["connections"][NOM] = {
    "main": [[{"node": "Choisir le canal", "type": "main", "index": 0}]]
}
with open(CHEMIN, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print("Workflow mis a jour.")
