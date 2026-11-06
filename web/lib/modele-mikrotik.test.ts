import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clesModele, extraireCodeModele, normaliserModele } from "./modele-mikrotik.ts";

// Correspondance entre le modèle lu sur RouterOS (ex. « hAP ax³
// (C53UiG+5HPaxD2HPaxD) ») et le catalogue officiel MikroTik.
describe("normaliserModele", () => {
  it("aplatit casse, exposants et ponctuation", () => {
    assert.equal(normaliserModele("hAP ax³"), "hap ax3");
    assert.equal(normaliserModele("hap_ax-lite"), "hap ax lite");
    assert.equal(normaliserModele("  CCR2004-1G-12S+2XS "), "ccr2004 1g 12s 2xs");
  });
});

describe("extraireCodeModele", () => {
  it("lit le code entre parenthèses", () => {
    assert.equal(
      extraireCodeModele("hAP ax³ (C53UiG+5HPaxD2HPaxD)"),
      "C53UiG+5HPaxD2HPaxD",
    );
  });

  it("retourne null sans code", () => {
    assert.equal(extraireCodeModele("hAP ax3"), null);
    assert.equal(extraireCodeModele(null), null);
  });
});

describe("clesModele", () => {
  it("produit le code, le nom et le slug comme clés", () => {
    const cles = clesModele("hAP ax³ (C53UiG+5HPaxD2HPaxD)");
    assert.ok(cles.includes("c53uig+5hpaxd2hpaxd"));
    assert.ok(cles.includes("hap ax3"));
    assert.ok(cles.includes("hap_ax3"));
  });

  it("gère un modèle simple et une entrée vide", () => {
    assert.deepEqual(clesModele("hAP ac²"), ["hap ac2", "hap_ac2"]);
    assert.deepEqual(clesModele(""), []);
    assert.deepEqual(clesModele(null), []);
  });
});
