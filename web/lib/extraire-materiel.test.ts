import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extraireMateriel, formaterMemoire } from "./extraire-materiel.ts";

const RESSOURCE = {
  "board-name": "hEX",
  version: "7.16 (stable)",
  cpu: "MIPS 1004Kc V2.15",
  "cpu-count": "4",
  "cpu-load": "7",
  "total-memory": "268435456",
  "free-memory": "134217728",
};

describe("extraireMateriel", () => {
  it("affiche le nom commercial et la reference", () => {
    const m = extraireMateriel(RESSOURCE, { model: "RB750Gr3" });
    assert.equal(m.modele, "hEX (RB750Gr3)");
    assert.equal(m.coeurs, 4);
    assert.equal(m.chargeCpu, 7);
    assert.equal(m.ramTotale, 268435456);
    assert.equal(m.ramLibre, 134217728);
  });

  it("utilise le nom de la carte sans RouterBOARD", () => {
    assert.equal(extraireMateriel(RESSOURCE, null).modele, "hEX");
  });

  it("n'affiche pas deux fois le meme nom", () => {
    assert.equal(extraireMateriel(RESSOURCE, { model: "hEX" }).modele, "hEX");
  });

  it("ignore une valeur illisible au lieu d'afficher un faux nombre", () => {
    const m = extraireMateriel({ "total-memory": "abc", "cpu-load": "" }, null);
    assert.equal(m.modele, null);
    assert.equal(m.ramTotale, null);
    assert.equal(m.chargeCpu, null);
  });
});

describe("formaterMemoire", () => {
  it("affiche des Mo puis des Go", () => {
    assert.equal(formaterMemoire(268435456), "256 Mo");
    assert.equal(formaterMemoire(2147483648), "2,0 Go");
  });
});
