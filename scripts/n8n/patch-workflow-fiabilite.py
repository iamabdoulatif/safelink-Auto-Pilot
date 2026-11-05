#!/usr/bin/env python3
"""Répare le flux automatique du workflow Mikhmon (idempotent).

- « Paramètres Mikhmon » perdait runId et simulation : retour sans horodatage
  (401) et simulation capable de créer de vrais tickets.
- « Paramètres Mikhmon » ne traitait que le premier job de la rafale.
- « Aucun ticket à générer » perdait la config : run jamais clôturé.
- onError était rangé dans parameters : n8n l'ignorait, aucune erreur ne
  remontait à l'application. Les envois sont aussi branchés sur l'erreur.
- Les nodes if v2.2 portaient des conditions au format v1.
Utilisation : python3 scripts/n8n/patch-workflow-fiabilite.py
"""
import json
from pathlib import Path

CHEMIN = (Path(__file__).resolve().parent.parent.parent
          / "n8n" / "workflows" / "workflow-mikhmon-patched.json")
ERREUR = "Préparer l'erreur signée"
AVEC_ERREUR = ("Lire le stock du profil", "Générer les tickets dans RouterOS",
               "Convertir en PDF (Gotenberg)", "Vérifier le bot Telegram",
               "Envoyer PDF Telegram", "Envoyer PDF WhatsApp (adaptateur)",
               "Imprimer via PrintNode")

CODE_AUCUN = (
    "return $input.all().map(i => ({ json: { ...i.json, status: "
    "'no_generation', message: `Stock suffisant pour le profil "
    "${i.json.profile}.` } }));"
)

CODE_ERREUR = r"""// Le node en échec ne rend pas toujours sa config : on la reprend en amont.
var recus = $input.all();
var premier = (recus[0] || {}).json || {};
var brut = premier.erreur || premier.error || premier.message
  || "Échec pendant le traitement (voir l'exécution n8n).";
if (typeof brut === 'object') brut = brut.message || JSON.stringify(brut);
// Une URL Telegram en erreur contient le jeton : jamais vers l'application.
var message = String(brut).replace(/bot\d+:[\w-]+/g, 'bot<masqué>').slice(0, 500);
var cibles = recus.filter(function (it) { return it.json && it.json.runId; });
// ponytail: sans runId sur l'élément en échec, tous les jobs de la rafale
// sont clôturés en échec ; à affiner si plusieurs règles échouent séparément.
if (!cibles.length) {
  try { cibles = $('Paramètres Mikhmon').all().filter(function (it) { return it.json && it.json.runId; }); }
  catch (e) { cibles = []; }
}
if (!cibles.length) throw new Error('Erreur sans runId : ' + message);
return cibles.map(function (it) {
  return { json: Object.assign({}, it.json, { erreur: message }) };
});
"""


def condition(gauche, operateur, droite=None):
    cond = {"leftValue": gauche, "operator": operateur}
    if droite is not None:
        cond["rightValue"] = droite
    return cond


VRAI = {"type": "boolean", "operation": "true", "singleValue": True}
EGAL = {"type": "string", "operation": "equals"}


def format_v2(params):
    ancien = params["conditions"]
    if "conditions" in ancien:
        return
    conds = [condition(c["value1"], VRAI) for c in ancien.get("boolean", [])]
    conds += [condition(c["value1"], EGAL, c["value2"])
              for c in ancien.get("string", [])]
    for i, cond in enumerate(conds):
        cond["id"] = "cond-" + str(i)
    params["conditions"] = {
        "options": {"caseSensitive": True, "leftValue": "",
                    "typeValidation": "loose", "version": 2},
        "conditions": conds,
        "combinator": ancien.get("combinator", "and"),
    }
    params["looseTypeValidation"] = True


def appliquer(doc):
    noeuds = {n["name"]: n for n in doc["nodes"]}
    code = noeuds["Paramètres Mikhmon"]["parameters"]
    if "simulation: input.simulation === true" not in code["jsCode"]:
        ancre = "  cleIdempotence: cleIdempotence,\n"
        if ancre not in code["jsCode"]:
            raise SystemExit("Ancre introuvable dans Paramètres Mikhmon.")
        # runId seulement pour un job : le flux manuel garde son retour dédié.
        code["jsCode"] = code["jsCode"].replace(ancre, ancre + (
            "  runId: reponseJob && reponseJob.runId ? String(reponseJob.runId) : '',\n"
            "  simulation: input.simulation === true,\n"))
    # $json ne voit que le premier élément : les autres jobs restaient bloqués.
    entete = "const input = $json.body ?? $json;\n"
    fin = "return profiles.map(profile => ({ json: { ...shared, profile } }));"
    if code["jsCode"].startswith(entete):
        if fin not in code["jsCode"]:
            raise SystemExit("Fin introuvable dans Paramètres Mikhmon.")
        code["jsCode"] = (
            "const sortiesParams = [];\n"
            "for (const entreeParams of $input.all()) {\n"
            "const input = entreeParams.json.body ?? entreeParams.json;\n"
            + code["jsCode"][len(entete):].replace(
                fin, "sortiesParams.push(...profiles.map(profile => "
                     "({ json: { ...shared, profile } })));\n}\n"
                     "return sortiesParams;"))
    noeuds["Aucun ticket à générer"]["parameters"]["jsCode"] = CODE_AUCUN
    noeuds[ERREUR]["parameters"]["jsCode"] = CODE_ERREUR

    for nom in AVEC_ERREUR:
        noeuds[nom]["parameters"].pop("onError", None)
        noeuds[nom]["onError"] = "continueErrorOutput"
        sorties = doc["connections"].setdefault(nom, {"main": []})["main"]
        while len(sorties) < 2:
            sorties.append([])
        if not any(c["node"] == ERREUR for c in sorties[1]):
            sorties[1].append({"node": ERREUR, "type": "main", "index": 0})

    for noeud in doc["nodes"]:
        if noeud["type"] == "n8n-nodes-base.if":
            format_v2(noeud["parameters"])


def main():
    with open(CHEMIN, encoding="utf-8") as f:
        doc = json.load(f)
    appliquer(doc)
    with open(CHEMIN, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("Workflow réparé.")


if __name__ == "__main__":
    main()
