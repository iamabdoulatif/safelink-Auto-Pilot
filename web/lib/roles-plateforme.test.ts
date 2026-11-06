import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  peutAttribuer,
  peutRetirer,
  roleEffectif,
} from "./roles-plateforme.ts";

// Rôles de la plateforme : superadmin (environnement serveur, jamais
// stocké), admin et contributeur (stockés, attribués par le
// superadmin). Le retrait d'un compte est définitif et protégé.
describe("roleEffectif", () => {
  it("le superadmin vient de l'environnement, pas de la base", () => {
    assert.equal(roleEffectif(true, "contributeur"), "superadmin");
    assert.equal(roleEffectif(true, "admin"), "superadmin");
    assert.equal(roleEffectif(false, "admin"), "admin");
    assert.equal(roleEffectif(false, "contributeur"), "contributeur");
    assert.equal(roleEffectif(false, null), "contributeur");
  });
});

describe("peutRetirer", () => {
  it("seul le superadmin retire, et seulement un contributeur", () => {
    assert.equal(peutRetirer("superadmin", "contributeur", false), true);
    assert.equal(peutRetirer("admin", "contributeur", false), false);
    assert.equal(peutRetirer("contributeur", "contributeur", false), false);
  });

  it("ni le superadmin ni un admin ne peuvent être retirés", () => {
    assert.equal(peutRetirer("superadmin", "superadmin", false), false);
    assert.equal(peutRetirer("superadmin", "admin", false), false);
  });

  it("personne ne se retire soi-même", () => {
    assert.equal(peutRetirer("superadmin", "contributeur", true), false);
  });
});

describe("peutAttribuer", () => {
  it("le superadmin attribue admin ou contributeur, jamais superadmin", () => {
    assert.equal(peutAttribuer("superadmin", "contributeur", "admin"), true);
    assert.equal(peutAttribuer("superadmin", "admin", "contributeur"), true);
    assert.equal(peutAttribuer("superadmin", "contributeur", "superadmin"), false);
  });

  it("le rôle d'un superadmin ne se touche pas, et l'admin ne décide pas", () => {
    assert.equal(peutAttribuer("superadmin", "superadmin", "contributeur"), false);
    assert.equal(peutAttribuer("admin", "contributeur", "admin"), false);
  });
});
