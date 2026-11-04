import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { politiqueTls } from "./routeros.ts";

// Le certificat est verifie par defaut. L'exception labo n'existe que
// via ROUTEROS_TLS_INSECURE explicite, jamais en production, et jamais
// en silence (avertissement a chaque activation).
describe("politiqueTls", () => {
  it("verifie par defaut (aucune variable)", () => {
    assert.deepEqual(politiqueTls({}, false), { verifier: true, avertir: false });
  });

  it("verifie quand la variable vaut n'importe quoi d'autre", () => {
    assert.deepEqual(politiqueTls({ ROUTEROS_TLS_INSECURE: "0" }, false).verifier, true);
    assert.deepEqual(politiqueTls({ ROUTEROS_TLS_INSECURE: "non" }, false).verifier, true);
  });

  it("autorise l'exception labo avec avertissement (hors prod)", () => {
    for (const v of ["1", "true", "oui"]) {
      const p = politiqueTls({ ROUTEROS_TLS_INSECURE: v }, false);
      assert.equal(p.verifier, false);
      assert.equal(p.avertir, true);
    }
  });

  it("refuse l'exception en production meme si demandee", () => {
    const p = politiqueTls({ ROUTEROS_TLS_INSECURE: "1" }, true);
    assert.equal(p.verifier, true);
    assert.equal(p.avertir, true);
  });
});
