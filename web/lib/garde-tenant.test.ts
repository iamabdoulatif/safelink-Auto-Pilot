import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ErreurAcces, exigerProprietaire } from "./garde-tenant.ts";

// Preuve d'isolation : le tenant A ne lit ni ne modifie les lignes du
// tenant B. Toute ligne d'un autre espace rend 404 (pas 403, pour ne
// pas reveler l'existence de la donnee).
describe("exigerProprietaire", () => {
  it("rend la ligne quand elle appartient au tenant (A lit A)", () => {
    const ligne = { id: 1, tenant_id: "a@exemple.fr", nom: "routeur-a" };
    assert.equal(exigerProprietaire("a@exemple.fr", ligne), ligne);
  });

  it("refuse quand la ligne appartient a un autre tenant (A lit B)", () => {
    const ligne = { id: 2, tenant_id: "b@exemple.fr", nom: "routeur-b" };
    assert.throws(() => exigerProprietaire("a@exemple.fr", ligne), (e) => {
      assert.ok(e instanceof ErreurAcces);
      assert.equal(e.statut, 404);
      return true;
    });
  });

  it("refuse dans l'autre sens aussi (B lit A)", () => {
    const ligne = { id: 1, tenant_id: "a@exemple.fr", nom: "routeur-a" };
    assert.throws(() => exigerProprietaire("b@exemple.fr", ligne), (e) => {
      assert.ok(e instanceof ErreurAcces);
      assert.equal(e.statut, 404);
      return true;
    });
  });

  it("refuse quand la ligne n'existe pas", () => {
    assert.throws(() => exigerProprietaire("a@exemple.fr", null), (e) => {
      assert.ok(e instanceof ErreurAcces);
      assert.equal(e.statut, 404);
      return true;
    });
  });
});
