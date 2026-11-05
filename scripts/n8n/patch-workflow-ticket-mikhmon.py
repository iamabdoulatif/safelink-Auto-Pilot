#!/usr/bin/env python3
"""Tickets au format Mikhmon dans le workflow automatique (idempotent).

Identifiant = mot de passe (préfixe du profil + chiffres, 8 caractères),
commentaire vc-<lot>-<mm.dd.yy> comme Mikhmon, PDF au template client.
Utilisation : python3 scripts/n8n/patch-workflow-ticket-mikhmon.py
"""
import json
import re
from pathlib import Path

CHEMIN = (Path(__file__).resolve().parent.parent.parent
          / "n8n" / "workflows" / "workflow-mikhmon-patched.json")

CSS = """@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&display=swap');
.bg-100{background:#FF4136}.bg-200{background:#FF851B}.bg-300{background:#FFDC00}.bg-500{background:#2ECC40}.bg-700{background:#39CCCC}.bg-1000{background:#0074D9}.bg-1500{background:#B10DC9}.bg-2500{background:#F012BE}.bg-3000{background:#85144b}.bg-default{background:#AAAAAA}
@page{size:A4;margin:5mm}
body{margin:0;padding:0}
.voucher-mini{print-color-adjust:exact;-webkit-print-color-adjust:exact;page-break-inside:avoid;display:inline-flex;flex-direction:column;width:142px;height:82px;margin:2px;background:white;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;box-sizing:border-box;font-family:'Outfit',sans-serif;vertical-align:top;float:left;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.voucher-header{color:white;padding:2px 4px;text-align:center;height:14px;display:flex;align-items:center;justify-content:center}
.hotspot-name{font-size:8px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:14px;width:100%;text-shadow:0 1px 2px rgba(0,0,0,.2)}
.voucher-body{padding:2px 2px 1px;flex-grow:1;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;background:white}
.code-box{background:#f8fafc;border:1px dashed #cbd5e0;border-radius:4px;padding:2px 5px;margin:1px 0;width:92%;text-align:center;box-sizing:content-box}
.code-text{font-size:16px;font-weight:800;color:#1e293b;word-break:break-all;line-height:1.1;letter-spacing:.5px}
.voucher-label{font-size:6px;text-transform:uppercase;color:#64748b;margin-bottom:0;font-weight:600;letter-spacing:.3px}
.footer-meta{display:flex;gap:3px;margin-top:2px;flex-wrap:wrap;justify-content:center;align-items:center}
.meta-badge{font-size:8px;background:#f1f5f9;padding:1px 4px;border-radius:3px;color:#334155;font-weight:700;white-space:nowrap;border:1px solid #e2e8f0;letter-spacing:.2px}
.meta-badge.price{background:#fef3c7;color:#92400e;border-color:#fde68a}
.meta-badge.validity{background:#dbeafe;color:#1e40af;border-color:#bfdbfe}
.seller-line{margin-top:1px;max-width:94%;font-size:6px;line-height:1;color:#64748b;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.seller-line strong{color:#334155;font-weight:800}"""

AIDES = r"""// Format Mikhmon : 05-JOURS -> 5j, puis 6 chiffres ; mot de passe = identifiant.
const prefixeDuProfil = (p) => { const m = String(p || '').match(/^0*(\d+)\s*-?\s*([HJSM])/i); return m ? m[1] + m[2].toLowerCase() : ''; };
const chiffres = (n) => { const o = aleatoireCrypto(n); let s = ''; for (let i = 0; i < n; i++) s += '23456789'[o[i] % 8]; return s; };
const dateMikhmon = (d) => String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCFullYear()).slice(-2);
const COULEURS = { 100: 'bg-100', 200: 'bg-200', 300: 'bg-300', 500: 'bg-500', 700: 'bg-700', 1000: 'bg-1000', 1500: 'bg-1500', 2500: 'bg-2500', 3000: 'bg-3000' };
const JOURS = { 1: '01-JOUR', 3: '03-JOURS', 5: '05-JOURS', 7: '01-SEMAINE', 10: '10-JOURS', 14: '02-SEMAINES', 30: '01-MOIS', 60: '02-MOIS', 90: '03-MOIS' };
const afficherValidite = (v, profil) => { const s = String(v || '').trim().toLowerCase(); let m = s.match(/^(\d+)h$/); if (m) return String(Number(m[1])).padStart(2, '0') + '-HEURES'; m = s.match(/^(\d+)d$/); if (m) return JOURS[Number(m[1])] || String(Number(m[1])).padStart(2, '0') + '-JOURS'; return (s ? s : String(profil || '')).toUpperCase(); };
// Lecture comme Mikhmon : on-login = x,x,prix,validite,prix de vente,...
const lirePrixValidite = (onLogin) => { const c = String(onLogin || '').split(','); const num = (v) => parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0; return { prix: num(c[4]) || num(c[2]), validite: c[3] || '' }; };
const afficherPrix = (n) => n >= 1000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(n);
"""

RENDU = r"""let prixValidite = { prix: 0, validite: '' };
  try {
    const liste = await this.helpers.httpRequest({ method: 'GET', url: cfg.routerBaseUrl + '/rest/ip/hotspot/user/profile', headers: { Authorization: auth, Accept: 'application/json' }, json: true, timeout: 30000, skipSslCertificateValidation: (['1', 'true', 'oui'].indexOf(String(($env && $env.ROUTEROS_TLS_INSECURE) || '').toLowerCase()) !== -1) });
    const trouve = (Array.isArray(liste) ? liste : []).find(p => String(p.name) === cfg.profile);
    if (trouve) prixValidite = lirePrixValidite(trouve['on-login']);
  } catch (ePrix) { /* le ticket reste valable sans prix affiché */ }
  const nomHotspot = String(cfg.nomTicket || cfg.routeurNom || '');
  const classe = COULEURS[prixValidite.prix] || 'bg-default';
  const validiteAffichee = afficherValidite(prixValidite.validite, cfg.profile);
  const vendeur = dateMikhmon(new Date());
  const rows = tickets.map((t, n) => `<div class="voucher-mini"><div class="voucher-header ${classe}"><div class="hotspot-name">${esc(nomHotspot)} <span style="font-weight:400;opacity:.85">[${n + 1}]</span></div></div><div class="voucher-body"><div class="voucher-label">Code Ticket</div><div class="code-box"><div class="code-text">${esc(t.username)}</div></div><div class="footer-meta">${validiteAffichee ? `<span class="meta-badge validity">${esc(validiteAffichee)}</span>` : ''}${prixValidite.prix > 0 ? `<span class="meta-badge price">${esc(afficherPrix(prixValidite.prix))} F</span>` : ''}</div><div class="seller-line"><strong>Sold by:</strong> ${esc(vendeur)}</div></div></div>`).join('');
  const html = `<!doctype html><html><head><meta charset='utf-8'><title>Tickets ${esc(cfg.profile)}</title><style>__CSS__</style></head><body>${rows}</body></html>`;"""


def remplacer(texte, ancien, nouveau):
    if ancien not in texte:
        raise SystemExit("Ancre introuvable : " + ancien[:60])
    return texte.replace(ancien, nouveau, 1)


def main():
    with open(CHEMIN, encoding="utf-8") as f:
        doc = json.load(f)
    noeuds = {n["name"]: n for n in doc["nodes"]}
    gen = noeuds["Générer les tickets dans RouterOS"]["parameters"]
    if "prefixeDuProfil" not in gen["jsCode"]:
        c = gen["jsCode"]
        c = remplacer(c, "const usedNames = new Set();", AIDES + "const usedNames = new Set();")
        c = remplacer(c, "const u = (prefix || '') + rand(len);", "const u = (prefix || '') + chiffres(len);")
        c = remplacer(c, "const tickets = [];\n",
                      "const tickets = [];\n"
                      "  const prefixeTicket = cfg.prefix || prefixeDuProfil(cfg.profile);\n"
                      "  const lotTicket = 100 + (aleatoireCrypto(2).readUInt16BE(0) % 900);\n"
                      "  const commentaireTicket = 'vc-' + lotTicket + '-' + dateMikhmon(new Date()) + (cle ? '-cle:' + cle : '');\n")
        c = remplacer(c, "const username = uniqueUsername(cfg.prefix, cfg.usernameLength);\n    const password = rand(cfg.passwordLength);",
                      "const username = uniqueUsername(prefixeTicket, 6);\n    const password = username;")
        c, n = re.subn(r"comment: 'n8n-mikhmon tenant:'.*?new Date\(\)\.toISOString\(\) \}", "comment: commentaireTicket }", c, count=1)
        if n != 1:
            raise SystemExit("Commentaire introuvable.")
        debut = c.index("const rows = tickets.map")
        fin = c.index("</table>`;", debut) + len("</table>`;")
        c = c[:debut] + RENDU.replace("__CSS__", CSS.replace("\n", "")) + c[fin:]
        gen["jsCode"] = c

    # Commentaire strictement Mikhmon (vc-700-10.31.26) et 8 caractères au total.
    if "commentaireDuLot" not in gen["jsCode"]:
        c = gen["jsCode"]
        c = remplacer(c, "const usedNames = new Set();",
                      "// ponytail: lot déduit du runId pour détecter un rejeu sans marque dans le\n"
                      "// commentaire ; 1 chance sur 900 de collision le même jour, le cycle suivant reprend.\n"
                      "const commentaireDuLot = (cleLot) => { const lot = cleLot ? 100 + (require('crypto').createHash('sha256').update(cleLot).digest().readUInt16BE(0) % 900) : 100 + (aleatoireCrypto(2).readUInt16BE(0) % 900); return 'vc-' + lot + '-' + dateMikhmon(new Date()); };\n"
                      "const usedNames = new Set();")
        c = remplacer(c, "existants.some(function (u) { return String((u && u.comment) || '').indexOf(marqueur) !== -1; })",
                      "existants.some(function (u) { const cu = String((u && u.comment) || ''); return cu.indexOf(marqueur) !== -1 || cu === commentaireDuLot(cle); })")
        c = remplacer(c, "  const lotTicket = 100 + (aleatoireCrypto(2).readUInt16BE(0) % 900);\n"
                         "  const commentaireTicket = 'vc-' + lotTicket + '-' + dateMikhmon(new Date()) + (cle ? '-cle:' + cle : '');\n",
                      "  const commentaireTicket = commentaireDuLot(cle);\n")
        c = remplacer(c, "uniqueUsername(prefixeTicket, 6)",
                      "uniqueUsername(prefixeTicket, Math.max(4, 8 - prefixeTicket.length))")
        gen["jsCode"] = c

    code = noeuds["Paramètres Mikhmon"]["parameters"]
    if "nomTicket" not in code["jsCode"]:
        c = code["jsCode"]
        c = remplacer(c, "  input.tenantId = reponseJob.tenantId;\n",
                      "  input.tenantId = reponseJob.tenantId;\n"
                      "  input.routeurNom = routeurJob.nom || '';\n"
                      "  input.nomTicket = routeurJob.nomTicket || '';\n")
        c = remplacer(c, "  cleIdempotence: cleIdempotence,\n",
                      "  cleIdempotence: cleIdempotence,\n"
                      "  routeurNom: String(input.routeurNom || ''),\n"
                      "  nomTicket: String(input.nomTicket || ''),\n")
        code["jsCode"] = c

    # Gotenberg : A4 du template et couleurs d'en-tête imprimées.
    pdf = noeuds["Convertir en PDF (Gotenberg)"]["parameters"]["bodyParameters"]["parameters"]
    if not any(p.get("name") == "preferCssPageSize" for p in pdf):
        pdf.append({"name": "preferCssPageSize", "value": "true"})
        pdf.append({"name": "printBackground", "value": "true"})

    with open(CHEMIN, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("Template Mikhmon appliqué.")


if __name__ == "__main__":
    main()
