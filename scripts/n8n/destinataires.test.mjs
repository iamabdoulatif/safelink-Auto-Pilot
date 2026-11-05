import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Execute le code livre du node, sans reseau : un destinataire refuse ne doit
// pas bloquer le lot, ni faire fuiter l'URL qui contient le jeton du bot.
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const doc = JSON.parse(readFileSync(
  join(RACINE, "n8n/workflows/workflow-mikhmon-patched.json"), "utf-8"));
const code = doc.nodes.find((n) => n.name === "Envoyer aux autres destinataires").parameters.jsCode;
const Asynchrone = Object.getPrototypeOf(async function () {}).constructor;

async function executer(liste, envoyer) {
  const f = new Asynchrone("$input", code);
  const items = [{ json: { profile: "10-JOURS", generatedCount: 120, destinatairesSupplementaires: liste }, binary: { data: {} } }];
  const helpers = { getBinaryDataBuffer: async () => Buffer.from("%PDF"), httpRequest: envoyer };
  return f.call({ helpers }, { all: () => items });
}

describe("envoi aux autres destinataires", () => {
  it("envoie le PDF sur chaque canal avec le bon champ", async () => {
    const appels = [];
    const [s] = await executer([
      { canal: "telegram", destinataire: "42", url: "https://t/bot1:a/sendDocument" },
      { canal: "whatsapp", destinataire: "+22507", url: "https://w" },
    ], async (o) => { appels.push(o); });
    assert.equal(appels.length, 2);
    assert.match(appels[0].body.toString(), /name="chat_id"[\s\S]*42[\s\S]*name="document"[\s\S]*%PDF/);
    assert.match(appels[1].body.toString(), /name="to"[\s\S]*\+22507[\s\S]*name="file"[\s\S]*%PDF/);
    assert.equal(s.json.avertissementEnvoi, "");
    assert.ok(s.binary.data, "le PDF reste disponible pour le canal principal");
    assert.deepEqual(s.json.destinatairesSupplementaires, []);
  });

  it("continue apres un echec et ne journalise pas le jeton", async () => {
    let appels = 0;
    const [s] = await executer([
      { canal: "telegram", destinataire: "42", url: "https://t/bot1:SECRET/sendDocument" },
      { canal: "whatsapp", destinataire: "+22507", url: null },
      { canal: "telegram", destinataire: "43", url: "https://t/bot1:SECRET/sendDocument" },
    ], async (o) => {
      appels++;
      if (appels === 1) throw new Error("echec " + o.url);
    });
    assert.equal(appels, 2);
    assert.match(s.json.avertissementEnvoi, /telegram 42, whatsapp \+22507/);
    assert.doesNotMatch(s.json.avertissementEnvoi, /SECRET/);
  });

  it("ne lit pas le PDF sans destinataire", async () => {
    const [s] = await executer([], async () => { throw new Error("aucun appel attendu"); });
    assert.equal(s.json.avertissementEnvoi, "");
  });
});
