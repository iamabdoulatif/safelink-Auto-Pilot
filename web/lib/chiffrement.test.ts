import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.CHIFFREMENT_CLE = "ab".repeat(32);
const { chiffrer, dechiffrer } = await import("./chiffrement.ts");

describe("chiffrement des secrets", () => {
  it("relit un secret ordinaire", () => {
    assert.equal(dechiffrer(chiffrer("mot-de-passe")), "mot-de-passe");
  });

  it("relit un secret vide (compte sans mot de passe)", () => {
    assert.equal(dechiffrer(chiffrer("")), "");
  });

  it("refuse un secret altéré", () => {
    const opaque = chiffrer("secret");
    const morceaux = opaque.split(":");
    const paquet = Buffer.from(morceaux[2], "base64");
    paquet[paquet.length - 1] ^= 1;
    assert.throws(() =>
      dechiffrer(`${morceaux[0]}:${morceaux[1]}:${paquet.toString("base64")}`),
    );
  });
});
