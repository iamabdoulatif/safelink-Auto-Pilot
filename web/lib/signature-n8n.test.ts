import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { canonicaliser, signer, verifierBrut } from "./signature.ts";

// Non-regression : les appels internes n8n gardent leur HMAC independant.
// Ces tests prouvent que le chantier session ne l'a pas casse.
describe("signature n8n (HMAC)", () => {
  it("signer couvre la charge canonique, verifiee sur le brut envoye", () => {
    const secret = "secret-partage-n8n";
    const charge = { statut: "termine", runId: "abc" };
    const signature = signer(secret, charge);
    const brut = canonicaliser(charge);
    assert.equal(verifierBrut(secret, brut, signature), true);
  });

  it("accepte une signature calculee sur le corps brut", () => {
    const secret = "secret-partage-n8n";
    const brut = '{"runId":"abc","statut":"termine"}';
    const signature = createHmac("sha256", secret).update(brut, "utf8").digest("hex");
    assert.equal(verifierBrut(secret, brut, signature), true);
  });

  it("refuse un corps altere", () => {
    const secret = "secret-partage-n8n";
    const signature = createHmac("sha256", secret)
      .update('{"runId":"abc"}', "utf8")
      .digest("hex");
    assert.equal(verifierBrut(secret, '{"runId":"abD"}', signature), false);
  });

  it("refuse sans secret ou avec un format invalide", () => {
    assert.equal(verifierBrut("", '{"a":1}', "00".repeat(32)), false);
    assert.equal(verifierBrut("secret", '{"a":1}', "pas-hex"), false);
    assert.equal(verifierBrut("secret", '{"a":1}', ""), false);
  });
});
