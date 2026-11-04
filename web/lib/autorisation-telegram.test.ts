import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  profilExisteSurRouteur,
  validerDemandeAutorisation,
} from "./autorisation-telegram.ts";

// L'autorisation ne fait JAMAIS confiance au tenantId envoye : il n'est
// meme pas lu. Seuls chatId/profil/quantite decides, puis la base et le
// routeur tranchen.
describe("validerDemandeAutorisation", () => {
  it("accepte une demande complete", () => {
    const r = validerDemandeAutorisation({
      chatId: "12345",
      routerId: 7,
      profile: "03-JOURS",
      qty: 120,
      tenantId: "pirate@ex.fr",
    });
    assert.deepEqual(r, { chatId: "12345", routeurId: 7, profil: "03-JOURS", qty: 120, simulation: false });
  });

  it("ignore le tenantId envoye (jamais lu)", () => {
    const r = validerDemandeAutorisation({
      chatId: "1",
      routerId: 7,
      profile: "03-JOURS",
      qty: 120,
      tenantId: "b@ex.fr",
    });
    assert.ok(!("tenantId" in (r as Record<string, unknown>)));
  });

  it("refuse chatId, profil et quantite invalides", () => {
    const cas: [unknown, string][] = [
      [{}, "chatId obligatoire."],
      [{ chatId: "1", profile: "03-JOURS", qty: 120 }, "Routeur obligatoire."],
      [{ chatId: "1", routerId: 7, profile: "", qty: 120 }, "Profil invalide."],
      [{ chatId: "1", routerId: 7, profile: "03-JOURS", qty: 7 }, "Quantité invalide."],
      [{ chatId: "1", routerId: 7, profile: "03-JOURS", qty: 120.5 }, "Quantité invalide."],
    ];
    for (const [corps, message] of cas) {
      const r = validerDemandeAutorisation(corps);
      assert.ok("erreur" in r);
      assert.equal(r.erreur, message);
    }
  });
});

describe("profilExisteSurRouteur", () => {
  it("trouve un profil existant (comparaison exacte)", async () => {
    assert.equal(await profilExisteSurRouteur(async () => [{ name: "03-JOURS" }], "03-JOURS"), true);
    assert.equal(await profilExisteSurRouteur(async () => [{ name: "03-jours" }], "03-JOURS"), false);
  });

  it("refuse quand la liste est vide ou malformee", async () => {
    assert.equal(await profilExisteSurRouteur(async () => [], "03-JOURS"), false);
    assert.equal(await profilExisteSurRouteur(async () => null, "03-JOURS"), false);
  });
});
