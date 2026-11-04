import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validerEntreeRun, type EntreeRun } from "./runs-tickets.ts";

// La borne 1..500 protege le routeur : une erreur de saisie ne doit pas
// creer des dizaines de milliers d'utilisateurs. validerEntreeRun est pure
// (aucune requete), on la teste directement.
function entree(quantity: number): EntreeRun {
  return {
    mikhmonConnectionId: 1,
    routerConnectionId: 2,
    profile: "03-JOURS",
    quantity,
    deliveryChannel: "interface",
    telegramChatId: null,
    runId: "run-test-borne",
  };
}

describe("validerEntreeRun", () => {
  it("accepte les quantites de 1 a 500", () => {
    assert.equal(validerEntreeRun(entree(1)), null);
    assert.equal(validerEntreeRun(entree(120)), null);
    assert.equal(validerEntreeRun(entree(500)), null);
  });
  it("refuse 0, les negatifs et plus de 500", () => {
    assert.match(validerEntreeRun(entree(0)) ?? "", /1 et 500/);
    assert.match(validerEntreeRun(entree(-3)) ?? "", /1 et 500/);
    assert.match(validerEntreeRun(entree(501)) ?? "", /1 et 500/);
  });
  it("refuse les quantites non entieres", () => {
    assert.match(validerEntreeRun(entree(2.5)) ?? "", /1 et 500/);
  });
});
