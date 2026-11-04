import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normaliserCourriel, validerMotDePasse } from "./auth.ts";

// L'inscription verrouille le format AVANT tout acces base : le tenant
// derive du courriel normalise, jamais d'un en-tete client.
describe("normaliserCourriel", () => {
  it("minuscule et rogne les espaces", () => {
    assert.equal(normaliserCourriel("  Alice@Exemple.fr "), "alice@exemple.fr");
  });

  it("refuse les formats invalides", () => {
    assert.equal(normaliserCourriel(""), null);
    assert.equal(normaliserCourriel("pas-un-courriel"), null);
    assert.equal(normaliserCourriel("a@b"), null);
    assert.equal(normaliserCourriel("avec espace@exemple.fr"), null);
  });
});

describe("validerMotDePasse", () => {
  it("exige 12 caracteres minimum", () => {
    assert.equal(validerMotDePasse("court-123"), "12 caractères minimum.");
    assert.equal(validerMotDePasse("Assez-Long-1234"), null);
  });
});
