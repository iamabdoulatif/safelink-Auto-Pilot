import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;

function codeDe(nom) {
  const doc = JSON.parse(
    readFileSync(join(RACINE, "n8n/workflows/workflow-mikhmon-patched.json"), "utf-8"),
  );
  const node = doc.nodes.find((n) => n.name === nom);
  if (!node) throw new Error("Node introuvable : " + nom);
  return node.parameters.jsCode;
}

async function executer(nom, cfg, appels) {
  const $input = { all: () => [{ json: cfg }] };
  const contexte = {
    helpers: {
      httpRequest: async (o) => { appels.push(o); return { ok: true }; },
    },
  };
  const $execution = { resumeUrl: "https://n8n.test/resume/abc" };
  const fn = new AsyncFunction("$input", "$env", "require", "$execution", codeDe(nom));
  const sorties = await fn.call(contexte, $input, {}, require, $execution);
  return sorties[0].json;
}

const CFG = {
  profile: "05-JOURS", quantity: 120, stockAvailable: 0, threshold: 50,
  routeurNom: "Zone Marché", routerBaseUrl: "https://routeur.test",
  approbationCanal: "telegram", approbationDestinataire: "424242",
  telegramBotToken: "jeton-fictif", whatsappWebhookUrl: "https://adaptateur.test/hook",
};

describe("Approbation avant génération (flux automatique)", () => {
  it("prépare le message de consentement avec quantité et profil", async () => {
    const j = await executer("Préparer la demande d'approbation", CFG, []);
    assert.match(j.approvalMessage, /génération de 120 tickets pour 05-JOURS/);
    assert.match(j.approvalMessage, /Vous consentez à cette génération \?/);
    assert.equal(j.approveUrl, "https://n8n.test/resume/abc?approved=true");
    assert.equal(j.rejectUrl, "https://n8n.test/resume/abc?approved=false");
  });

  it("envoie sur Telegram avec les boutons Approuver / Refuser", async () => {
    const appels = [];
    const prepare = await executer("Préparer la demande d'approbation", CFG, []);
    await executer("Envoyer la demande d'approbation", prepare, appels);
    assert.equal(appels.length, 1);
    assert.match(appels[0].url, /api\.telegram\.org\/botjeton-fictif\/sendMessage/);
    assert.equal(appels[0].body.chat_id, "424242");
    const boutons = appels[0].body.reply_markup.inline_keyboard[0];
    assert.equal(boutons[0].text, "✅ Approuver");
    assert.equal(boutons[1].text, "❌ Refuser");
  });

  it("envoie sur WhatsApp avec les liens d'approbation", async () => {
    const appels = [];
    const prepare = await executer("Préparer la demande d'approbation",
      { ...CFG, approbationCanal: "whatsapp", approbationDestinataire: "+22670000000" }, []);
    const j = await executer("Envoyer la demande d'approbation", prepare, appels);
    assert.equal(appels[0].url, "https://adaptateur.test/hook");
    assert.equal(appels[0].body.to, "+22670000000");
    assert.match(appels[0].body.text, /Approuver : https:\/\/n8n\.test/);
    assert.equal(j.approbationEnvoyee, "whatsapp");
  });

  it("valide la décision : oui génère, non refuse", async () => {
    const oui = await executer("Valider la décision (auto)",
      { ...CFG, query: { approved: "true" } }, []);
    assert.equal(oui.approved, true);
    const non = await executer("Valider la décision (auto)",
      { ...CFG, query: { approved: "false" } }, []);
    assert.equal(non.approved, false);
    const refuse = await executer("Génération refusée (auto)", non, []);
    assert.match(refuse.erreur, /refusée/);
    assert.deepEqual(refuse.tickets, []);
  });
});
