#!/usr/bin/env python3
"""Lots distincts par vendeur (rapport des ventes individuel).

À la génération, les tickets sont répartis en lots distincts entre
les vendeurs de la zone (commentaire vc-<lot>-<date>, un lot par
vendeur, format Mikhmon inchangé). Le mapping lot -> numéro remonte
dans le compte rendu signé, le SaaS le stocke, et le rapport des
ventes calcule alors les montants de chaque vendeur.

Ajouts seulement, ancrages vérifiés, sauvegarde horodatée.
Usage : python3 scripts/n8n/patch-workflow-lots-vendeurs.py
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


def main():
    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    noeuds = {n["name"]: n for n in donnees["nodes"]}
    for requis in ("Paramètres Mikhmon", "Générer les tickets dans RouterOS",
                   "Préparer le retour signé", "Calculer le rapport des ventes",
                   "Envoyer le rapport des ventes"):
        if requis not in noeuds:
            sys.exit(f"ECHEC : node manquant « {requis} ».")
    generer = noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"]
    if "commentairesVendeurs" in generer:
        sys.exit("ECHEC : lots vendeurs déjà présents.")

    # 1) Paramètres : vendeurs de la zone depuis la config signée.
    params = noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"]
    params = une_fois(
        params,
        "  input.approbationDestinataire = String(apprJob.destinataire || '');",
        "  input.approbationDestinataire = String(apprJob.destinataire || '');\n"
        "  input.vendeursZone = Array.isArray(livraisonJob.vendeursZone) ? livraisonJob.vendeursZone.map(String) : [];",
        "params vendeurs entree",
    )
    params = une_fois(
        params,
        "  approbationDestinataire: String(input.approbationDestinataire || '')\n};",
        "  approbationDestinataire: String(input.approbationDestinataire || ''),\n"
        "  vendeursZone: Array.isArray(input.vendeursZone) ? input.vendeursZone.map(String) : []\n};",
        "params vendeurs shared",
    )
    noeuds["Paramètres Mikhmon"]["parameters"]["jsCode"] = params

    # 2) Générer : un lot par vendeur, anti-doublon compatible.
    generer = une_fois(
        generer,
        "return 'vc-' + lot + '-' + dateMikhmon(new Date()); };",
        "return 'vc-' + lot + '-' + dateMikhmon(new Date()); };\n"
        "const vendeursDe = (cfg) => (Array.isArray(cfg.vendeursZone) ? cfg.vendeursZone.map(String).filter(Boolean) : []);\n"
        "const commentairesVendeurs = (cfg, cleLot) => { var v = vendeursDe(cfg); if (!v.length) return null; var base = cleLot ? 100 + (require('crypto').createHash('sha256').update(cleLot).digest().readUInt16BE(0) % 900) : 100 + (aleatoireCrypto(2).readUInt16BE(0) % 900); base = Math.min(base, 1000 - v.length); return v.map(function (numero, i) { return { numero: numero, lot: base + i, commentaire: 'vc-' + (base + i) + '-' + dateMikhmon(new Date()) }; }); };",
        "generer lots vendeurs",
    )
    generer = une_fois(
        generer,
        "return cu.indexOf(marqueur) !== -1 || cu === commentaireDuLot(cle);",
        "var cv = commentairesVendeurs(cfg, cle); return cu.indexOf(marqueur) !== -1 || cu === commentaireDuLot(cle) || (cv !== null && cv.some(function (x) { return cu === x.commentaire; }));",
        "generer anti-doublon",
    )
    generer = une_fois(
        generer,
        "const commentaireTicket = commentaireDuLot(cle);",
        "const lotsVendeurs = commentairesVendeurs(cfg, cle);\n  const commentaireTicket = commentaireDuLot(cle);",
        "generer commentaire",
    )
    generer = une_fois(
        generer,
        "comment: commentaireTicket }",
        "comment: lotsVendeurs ? lotsVendeurs[i % lotsVendeurs.length].commentaire : commentaireTicket }",
        "generer repartition",
    )
    generer = une_fois(
        generer,
        "stockApres: stockApres } });",
        "stockApres: stockApres, lotsVendeurs: lotsVendeurs || [] } });",
        "generer sortie",
    )
    noeuds["Générer les tickets dans RouterOS"]["parameters"]["jsCode"] = generer

    # 3) Retour signé : mapping lot -> vendeur (aucun secret).
    retour = noeuds["Préparer le retour signé"]["parameters"]["jsCode"]
    retour = une_fois(
        retour,
        "if (errAuto) contenuAuto.erreur = String(errAuto).slice(0, 500);",
        "if (errAuto) contenuAuto.erreur = String(errAuto).slice(0, 500);\n"
        "    if (Array.isArray(cfg.lotsVendeurs) && cfg.lotsVendeurs.length) contenuAuto.lotsVendeurs = cfg.lotsVendeurs.map(function (x) { return { numero: String(x.numero), lot: x.lot }; });",
        "retour lots vendeurs",
    )
    noeuds["Préparer le retour signé"]["parameters"]["jsCode"] = retour

    # 4) Rapport : ventes regroupées par vendeur via son lot.
    calculer = noeuds["Calculer le rapport des ventes"]["parameters"]["jsCode"]
    calculer = une_fois(
        calculer,
        "copie.montantFormate = fmt(totalVendu);",
        "var lotVendeur = {};\n"
        "  for (var lv = 0; lv < (cfg.lotsVendeurs || []).length; lv++) lotVendeur[String(cfg.lotsVendeurs[lv].lot)] = String(cfg.lotsVendeurs[lv].numero_vendeur || cfg.lotsVendeurs[lv].numero || '');\n"
        "  var parVendeur = {};\n"
        "  for (var w = 0; w < users.length; w++) { var wu = users[w]; if (parseUptime(wu.uptime) <= 0) continue; var wj = dateDuLot(wu.comment); if (!wj || wj < debut || wj >= fin) continue; var wm = String(wu.comment || '').match(/vc-(\\d+)-/); var wv = wm ? lotVendeur[wm[1]] : ''; if (!wv) continue; if (!parVendeur[wv]) parVendeur[wv] = { numero: wv, tickets: 0, montant: 0 }; parVendeur[wv].tickets += 1; parVendeur[wv].montant += (prix[String(wu.profile || '')] || 0); }\n"
        "  copie.parVendeur = Object.keys(parVendeur).sort().map(function (nom) { return parVendeur[nom]; });\n"
        "  copie.montantFormate = fmt(totalVendu);",
        "calculer par vendeur",
    )
    noeuds["Calculer le rapport des ventes"]["parameters"]["jsCode"] = calculer

    # 5) Envoi : gérant = détail vendeurs ; vendeur = ses propres ventes.
    envoyer = noeuds["Envoyer le rapport des ventes"]["parameters"]["jsCode"]
    envoyer = une_fois(
        envoyer,
        "const texteGestion = entete + (detail ? '\\n\\nDétail par profil :\\n' + detail : '\\n\\nAucune vente sur la période.');",
        "const parVendeur = cfg.parVendeur || [];\n"
        "  const detailVendeurs = parVendeur.map((v) => '• ' + v.numero + ' : ' + v.tickets + ' vendus · ' + fmt(v.montant)).join('\\n');\n"
        "  const texteGestion = entete + (detail ? '\\n\\nDétail par profil :\\n' + detail : '\\n\\nAucune vente sur la période.') + (detailVendeurs ? '\\n\\nPar vendeur :\\n' + detailVendeurs : '');",
        "envoyer gestion vendeurs",
    )
    envoyer = une_fois(
        envoyer,
        "const texteVendeur = entete + '\\n\\nPoint de votre zone. Le détail complet est chez le gérant.';",
        "const texteVendeurPour = (numero) => { const moi = (cfg.parVendeur || []).find((v) => v.numero === numero); return entete + '\\n\\n🧾 Vos ventes : ' + (moi ? moi.tickets : 0) + ' tickets · ' + fmt(moi ? moi.montant : 0) + '\\nPoint de votre zone. Le détail complet est chez le gérant.'; };",
        "envoyer texte vendeur",
    )
    envoyer = une_fois(
        envoyer,
        "for (const v of (zone.numerosVendeurs || [])) ajouter(v, texteVendeur);",
        "for (const v of (zone.numerosVendeurs || [])) ajouter(v, texteVendeurPour(String(v)));",
        "envoyer vendeurs personnalise",
    )
    noeuds["Envoyer le rapport des ventes"]["parameters"]["jsCode"] = envoyer

    noms = [n["name"] for n in donnees["nodes"]]
    assert len(noms) == len(set(noms))
    horodatage = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    shutil.copyfile(FICHIER, str(FICHIER) + "." + horodatage + ".bak")
    FICHIER.write_text(json.dumps(donnees, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    print("OK : lots distincts par vendeur ajoutés.")


if __name__ == "__main__":
    main()
