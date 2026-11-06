import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;

function codeGenerer() {
  const doc = JSON.parse(
    readFileSync(join(RACINE, "n8n/workflows/workflow-mikhmon-patched.json"), "utf-8"),
  );
  return doc.nodes.find((n) => n.name === "Générer les tickets dans RouterOS")
    .parameters.jsCode;
}

// Lots distincts par vendeur : chaque ticket reçoit le commentaire
// du lot de son vendeur (vc-<lot>-<date>), format Mikhmon inchangé.
describe("Lots distincts par vendeur", () => {
  it("répartit les tickets entre les vendeurs et rend le mapping", async () => {
    const crees = [];
    const routeur = { async httpRequest({ method, url, body }) {
      if (method === "GET" && url.endsWith("/user/profile")) {
        return [{ name: "01-JOUR", "on-login": "0,0,0,,5000," }];
      }
      if (method === "GET") return [];
      crees.push(body);
      return { name: body.name };
    } };
    const cfg = {
      routerBaseUrl: "https://routeur.test", routerUser: "u",
      routerPassword: "p", quantity: 4, prefix: "", usernameLength: 8,
      passwordLength: 8, profile: "01-JOUR", hotspotServer: "all",
      tenantId: "t", cleIdempotence: "run-lots-1", limitUptime: "",
      limitBytesTotal: "", vendeursZone: ["+22670000003", "+22670000004"],
      existingNames: [],
    };
    const $input = { all: () => [{ json: cfg }] };
    const contexte = { helpers: { httpRequest: (o) => routeur.httpRequest(o) } };
    const fn = new AsyncFunction("$input", "$env", "require", codeGenerer());
    const sorties = await fn.call(contexte, $input, {}, require);
    const j = sorties[0].json;
    assert.equal(j.generatedCount, 4);
    assert.equal(j.lotsVendeurs.length, 2);
    assert.notEqual(j.lotsVendeurs[0].lot, j.lotsVendeurs[1].lot);
    const commentaires = crees.map((c) => c.comment);
    assert.match(commentaires[0], /^vc-\d{3}-\d{2}\.\d{2}\.\d{2}$/);
    assert.equal(commentaires[0], j.lotsVendeurs[0].commentaire);
    assert.equal(commentaires[1], j.lotsVendeurs[1].commentaire);
    assert.equal(commentaires[2], j.lotsVendeurs[0].commentaire);
  });
});
