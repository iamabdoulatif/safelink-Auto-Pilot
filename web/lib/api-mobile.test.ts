import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DUREE_JETON_MOBILE_SECONDES,
  emettreJetonMobile,
  lireJetonBearer,
  verifierJetonMobile,
} from "./api-mobile.ts";

// Jeton Bearer mobile : même signature que la session web, 30 jours.
describe("api mobile", () => {
  it("émet et vérifie un jeton Bearer", () => {
    const jeton = emettreJetonMobile("secret-de-test", {
      utilisateurId: "a@exemple.ci", tenantId: "a@exemple.ci",
    });
    assert.equal(lireJetonBearer(`Bearer ${jeton}`), jeton);
    assert.equal(lireJetonBearer(`bearer ${jeton}`), jeton);
    assert.equal(lireJetonBearer("Basic abc"), null);
    assert.equal(lireJetonBearer(null), null);
    assert.deepEqual(verifierJetonMobile("secret-de-test", jeton), {
      utilisateurId: "a@exemple.ci", tenantId: "a@exemple.ci",
    });
    assert.equal(verifierJetonMobile("autre-secret", jeton), null);
    assert.equal(DUREE_JETON_MOBILE_SECONDES, 30 * 24 * 3600);
  });
});
