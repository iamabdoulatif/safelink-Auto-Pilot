import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decrirePeriode,
  formaterMontant,
  rapportEstDu,
} from "./rapports-ventes.ts";

// Cycles de 00h à 00h : décade (1-10, 11-20, 21-fin), semaine, mois.
describe("rapportEstDu", () => {
  it("décade : envoi le 11, le 21 et le 1er, pour le cycle fermé", () => {
    assert.deepEqual(rapportEstDu("decade", "2026-11-11"),
      { debut: "2026-11-01", fin: "2026-11-11" });
    assert.deepEqual(rapportEstDu("decade", "2026-11-21"),
      { debut: "2026-11-11", fin: "2026-11-21" });
    assert.deepEqual(rapportEstDu("decade", "2026-12-01"),
      { debut: "2026-11-21", fin: "2026-12-01" });
    assert.equal(rapportEstDu("decade", "2026-11-10"), null);
    assert.equal(rapportEstDu("decade", "2026-11-15"), null);
  });

  it("mensuel le 1er, hebdomadaire le lundi", () => {
    assert.deepEqual(rapportEstDu("mensuel", "2026-12-01"),
      { debut: "2026-11-01", fin: "2026-12-01" });
    assert.equal(rapportEstDu("mensuel", "2026-12-02"), null);
    // 2026-11-09 est un lundi.
    assert.deepEqual(rapportEstDu("hebdomadaire", "2026-11-09"),
      { debut: "2026-11-02", fin: "2026-11-09" });
    assert.equal(rapportEstDu("hebdomadaire", "2026-11-10"), null);
  });

  it("personnalisé : à la date d'envoi, fin incluse convertie en borne 00:00", () => {
    const p = { debut: "2026-11-01", fin: "2026-11-10", dateEnvoi: "2026-11-11" };
    assert.equal(rapportEstDu("personnalise", "2026-11-10", p), null);
    assert.deepEqual(rapportEstDu("personnalise", "2026-11-11", p),
      { debut: "2026-11-01", fin: "2026-11-11" });
  });
});

describe("affichage", () => {
  it("décrit la période et formate les montants entiers", () => {
    assert.equal(decrirePeriode({ debut: "2026-11-01", fin: "2026-11-11" }),
      "du 1er au 10 novembre 2026");
    assert.equal(decrirePeriode({ debut: "2026-11-21", fin: "2026-12-01" }),
      "du 21 au 30 novembre 2026");
    assert.equal(formaterMontant(20000), "20 000 F");
    assert.equal(formaterMontant(8000), "8 000 F");
  });
});
