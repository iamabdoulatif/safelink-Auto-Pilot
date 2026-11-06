import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estRole, roleAutorise } from "./roles.ts";

// Hiérarchie des rôles dans un espace : admin > contributeur >
// utilisateur. Chaque action exige un rôle minimum, contrôlé serveur.
describe("roleAutorise", () => {
  it("un admin peut tout faire", () => {
    assert.equal(roleAutorise("admin", "admin"), true);
    assert.equal(roleAutorise("admin", "contributeur"), true);
    assert.equal(roleAutorise("admin", "utilisateur"), true);
  });

  it("un contributeur génère mais ne configure pas", () => {
    assert.equal(roleAutorise("contributeur", "contributeur"), true);
    assert.equal(roleAutorise("contributeur", "utilisateur"), true);
    assert.equal(roleAutorise("contributeur", "admin"), false);
  });

  it("un utilisateur ne fait que consulter, et null ne fait rien", () => {
    assert.equal(roleAutorise("utilisateur", "utilisateur"), true);
    assert.equal(roleAutorise("utilisateur", "contributeur"), false);
    assert.equal(roleAutorise(null, "utilisateur"), false);
  });

  it("estRole ne reconnaît que les trois rôles", () => {
    assert.equal(estRole("admin"), true);
    assert.equal(estRole("contributeur"), true);
    assert.equal(estRole("utilisateur"), true);
    assert.equal(estRole("superadmin"), false);
    assert.equal(estRole(""), false);
    assert.equal(estRole(42), false);
  });
});
