import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Execute le code livre des nodes, sans reseau, avec un job signe fictif.
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const doc = JSON.parse(readFileSync(
  join(RACINE, "n8n/workflows/workflow-mikhmon-patched.json"), "utf-8"));
const noeud = (nom) => doc.nodes.find((n) => n.name === nom);

function executer(nom, json, { $ = () => { throw new Error("absent"); }, entrees } = {}) {
  const items = entrees ?? [{ json }];
  const f = new Function("$json", "$input", "$env", "$",
    noeud(nom).parameters.jsCode);
  return f(json, { all: () => items, first: () => items[0] }, {}, $);
}

const job = (simulation) => ({
  data: {
    runId: "run-1", tenantId: "t1", simulation,
    routeur: { adresse: "https://r", utilisateurEcriture: "u", motDePasseEcriture: "p" },
    lot: { profil: "01-JOUR", quantite: 5, seuil: 10 },
    livraison: { canal: "telegram", telegram: { chatId: "42", jeton: "1:a" } },
  },
});
const lectures = () => ({ all: () => [], first: () => ({ json: { appUrl: "https://app" } }) });

describe("flux automatique de réapprovisionnement", () => {
  it("Paramètres Mikhmon conserve runId et simulation", () => {
    const [{ json }] = executer("Paramètres Mikhmon", job(true), { $: lectures });
    assert.equal(json.runId, "run-1");
    assert.equal(json.simulation, true);
    assert.equal(json.callbackUrl, "https://app/api/internal/n8n/callback");
  });

  it("Paramètres Mikhmon traite tous les jobs de la rafale", () => {
    const second = job(false);
    second.data.runId = "run-2";
    second.data.lot.profil = "05-JOURS";
    const sorties = executer("Paramètres Mikhmon", job(false),
      { $: lectures, entrees: [{ json: job(false) }, { json: second }] });
    assert.deepEqual(sorties.map((s) => s.json.runId), ["run-1", "run-2"]);
    assert.deepEqual(sorties.map((s) => s.json.profile), ["01-JOUR", "05-JOURS"]);
  });

  it("le flux manuel reste sans runId interne", () => {
    const [{ json }] = executer("Paramètres Mikhmon", {
      runId: "manuel", routerBaseUrl: "https://r", routerPassword: "p",
      profile: "01-JOUR", deliveryChannel: "pdf",
    });
    assert.equal(json.runId, "");
    assert.equal(json.simulation, false);
  });

  it("Aucun ticket conserve de quoi clôturer le run", () => {
    const [{ json }] = executer("Aucun ticket à générer", {
      runId: "run-1", tenantId: "t1", callbackUrl: "https://app/cb",
      profile: "01-JOUR", stockAvailable: 20,
    });
    assert.equal(json.runId, "run-1");
    assert.equal(json.callbackUrl, "https://app/cb");
    assert.equal(json.status, "no_generation");
  });

  it("l'erreur retrouve le run en amont et masque le jeton", () => {
    const amont = [{ json: { runId: "run-1", tenantId: "t1" } }];
    const [{ json }] = executer("Préparer l'erreur signée",
      { error: "échec https://api.telegram.org/bot123:abc-DEF/sendDocument" },
      { $: () => ({ all: () => amont }) });
    assert.equal(json.runId, "run-1");
    assert.ok(json.erreur.includes("bot<masqué>"));
    assert.ok(!json.erreur.includes("abc-DEF"));
  });

  it("onError est au niveau du node et les if au format v2", () => {
    for (const n of doc.nodes) {
      assert.equal(n.parameters.onError, undefined, n.name);
      if (n.type === "n8n-nodes-base.if") {
        assert.ok(Array.isArray(n.parameters.conditions.conditions), n.name);
      }
    }
    for (const nom of ["Lire le stock du profil", "Envoyer PDF Telegram"]) {
      assert.equal(noeud(nom).onError, "continueErrorOutput");
      assert.equal(doc.connections[nom].main[1][0].node, "Préparer l'erreur signée");
    }
  });
});
