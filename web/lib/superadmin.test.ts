import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { courrielsSuperAdmin, estSuperAdmin } from "./superadmin.ts";

// La liste vient de l'environnement : casse et espaces ne comptent pas,
// et sans variable configurée, personne n'est superadmin.
describe("estSuperAdmin", () => {
  it("reconnaît un courriel listé, sans tenir compte de la casse", () => {
    const env = { SUPERADMIN_COURRIELS: "Admin@Exemple.fr, ops@exemple.fr" };
    assert.equal(estSuperAdmin("admin@exemple.fr", env), true);
    assert.equal(estSuperAdmin(" OPS@exemple.fr ", env), true);
  });

  it("refuse un courriel absent et une liste vide", () => {
    assert.equal(estSuperAdmin("x@exemple.fr", { SUPERADMIN_COURRIELS: "a@exemple.fr" }), false);
    assert.equal(estSuperAdmin("a@exemple.fr", {}), false);
    assert.deepEqual(courrielsSuperAdmin({}), []);
  });
});
