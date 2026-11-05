import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { modeJobReappro } from "./reappro-jobs.ts";

describe("modeJobReappro", () => {
  const regle = { actif: false, simulationReussie: false, stockRearme: true };

  it("simule une règle en pause jamais simulée, même en mode réel", () => {
    assert.deepEqual(modeJobReappro(regle, false),
      { simulation: true, surveillance: false });
    assert.deepEqual(modeJobReappro({ ...regle, stockRearme: false }, false),
      { simulation: true, surveillance: false });
  });

  it("garde une règle active en réel", () => {
    assert.deepEqual(
      modeJobReappro({ ...regle, actif: true, simulationReussie: true }, false),
      { simulation: false, surveillance: false });
  });

  it("met en surveillance une règle active désarmée", () => {
    assert.deepEqual(modeJobReappro(
      { actif: true, simulationReussie: true, stockRearme: false }, false),
      { simulation: false, surveillance: true });
  });

  it("respecte la simulation globale", () => {
    assert.deepEqual(modeJobReappro(
      { actif: true, simulationReussie: true, stockRearme: true }, true),
      { simulation: true, surveillance: false });
  });
});
