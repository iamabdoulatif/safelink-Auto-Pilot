import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hacherMotDePasse, verifierMotDePasse } from "./mot-de-passe.ts";

// Les mots de passe ne sont jamais stockes en clair : scrypt avec sel
// aleatoire, verification en temps constant.
describe("mot-de-passe", () => {
  it("deux hachages du meme mot different (sel aleatoire)", () => {
    const a = hacherMotDePasse("UnMotDePasse-Tres-Long-123");
    const b = hacherMotDePasse("UnMotDePasse-Tres-Long-123");
    assert.notEqual(a, b);
  });

  it("accepte le bon mot de passe", () => {
    const hash = hacherMotDePasse("UnMotDePasse-Tres-Long-123");
    assert.equal(verifierMotDePasse("UnMotDePasse-Tres-Long-123", hash), true);
  });

  it("refuse un mauvais mot de passe", () => {
    const hash = hacherMotDePasse("UnMotDePasse-Tres-Long-123");
    assert.equal(verifierMotDePasse("Autre-Mot-De-Passe-456", hash), false);
  });

  it("refuse un hachage malforme sans planter", () => {
    assert.equal(verifierMotDePasse("x", ""), false);
    assert.equal(verifierMotDePasse("x", "nimporte-quoi"), false);
  });
});
