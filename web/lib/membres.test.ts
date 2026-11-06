import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estRole, roleAutorise } from "./roles.ts";

// Hiérarchie des rôles métier dans un espace : admin > gerant >
// vendeur. Chaque action exige un rôle minimum, contrôlé serveur.
describe("roleAutorise", () => {
  it("un admin peut tout faire", () => {
    assert.equal(roleAutorise("admin", "admin"), true);
    assert.equal(roleAutorise("admin", "gerant"), true);
    assert.equal(roleAutorise("admin", "vendeur"), true);
  });

  it("un gerant génère mais ne configure pas", () => {
    assert.equal(roleAutorise("gerant", "gerant"), true);
    assert.equal(roleAutorise("gerant", "vendeur"), true);
    assert.equal(roleAutorise("gerant", "admin"), false);
  });

  it("un vendeur ne fait que consulter, et null ne fait rien", () => {
    assert.equal(roleAutorise("vendeur", "vendeur"), true);
    assert.equal(roleAutorise("vendeur", "gerant"), false);
    assert.equal(roleAutorise(null, "vendeur"), false);
  });

  it("estRole ne reconnaît que les trois rôles métier", () => {
    assert.equal(estRole("admin"), true);
    assert.equal(estRole("gerant"), true);
    assert.equal(estRole("vendeur"), true);
    assert.equal(estRole("contributeur"), false);
    assert.equal(estRole("utilisateur"), false);
    assert.equal(estRole("superadmin"), false);
    assert.equal(estRole(""), false);
    assert.equal(estRole(42), false);
  });
});
