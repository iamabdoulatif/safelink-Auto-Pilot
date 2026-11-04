import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifierPlan, type AppelRest } from "./correctif.ts";

// Aucune suppression ni zone critique ne part vers le routeur, meme
// avec un plan approuve : ces appels sont refuses avant la sauvegarde.
function appel(methode: AppelRest["methode"], chemin: string): AppelRest {
  return { methode, chemin, corps: {} };
}

describe("verifierPlan", () => {
  it("accepte DNS et NTP (correctifs legitimes)", () => {
    verifierPlan([appel("PUT", "/ip/dns"), appel("PATCH", "/system/ntp/client")]);
  });

  it("refuse toute suppression, meme hors zone sensible", () => {
    assert.throws(() => verifierPlan([appel("DELETE", "/ip/hotspot/user")]), /suppression/i);
    assert.throws(() => verifierPlan([appel("DELETE", "/ip/dns")]), /suppression/i);
  });

  it("refuse le pare-feu, les services, l'adressage et les routes", () => {
    for (const chemin of [
      "/ip/firewall/filter",
      "/ip/firewall/filter/3",
      "/ip/service",
      "/ip/address",
      "/ip/route",
    ]) {
      assert.throws(() => verifierPlan([appel("PATCH", chemin)]), /sensible/i);
    }
  });

  it("refuse utilisateurs, packages et interfaces critiques", () => {
    for (const chemin of [
      "/user",
      "/system/package",
      "/system/routerboard",
      "/interface/ethernet",
      "/interface/bridge",
    ]) {
      assert.throws(() => verifierPlan([appel("PATCH", chemin)]), /sensible/i);
    }
  });

  it("laisse passer le Wi-Fi (objet du diagnostic)", () => {
    verifierPlan([appel("PATCH", "/interface/wireless")]);
  });

  it("refuse un plan vide", () => {
    assert.throws(() => verifierPlan([]), /automatisa/i);
  });
});
