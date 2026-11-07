import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { conditionVue, estSignificatif } from "./historique-vues.ts";

// Trois vues de l'historique : la routine ne noie plus l'écran.
describe("vues de l'historique", () => {
  it("une génération réelle ou un échec est significatif", () => {
    assert.equal(estSignificatif(
      { quantite_creee: 120, statut: "termine", erreur: null }), true);
    assert.equal(estSignificatif(
      { quantite_creee: 0, statut: "echoue", erreur: null }), true);
    assert.equal(estSignificatif(
      { quantite_creee: 0, statut: "termine", erreur: "routeur" }), true);
    assert.equal(estSignificatif(
      { quantite_creee: 0, statut: "termine", erreur: null }), false);
  });

  it("les conditions SQL séparent routine, significatifs et archives", () => {
    assert.match(conditionVue("controles"), /quantite_creee = 0/);
    assert.match(conditionVue("significatifs"), /quantite_creee > 0/);
    assert.equal(conditionVue("archives"), "r.archive = true");
  });
});
