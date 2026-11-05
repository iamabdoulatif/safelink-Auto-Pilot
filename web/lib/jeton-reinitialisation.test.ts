import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  empreinteJeton,
  estChatPrive,
  genererJeton,
} from "./jeton-reinitialisation.ts";

describe("jeton de reinitialisation", () => {
  it("ne stocke jamais le jeton en clair", () => {
    const { jeton, empreinte } = genererJeton();
    assert.notEqual(jeton, empreinte);
    assert.equal(empreinte, empreinteJeton(jeton));
  });

  it("genere un jeton different a chaque appel", () => {
    assert.notEqual(genererJeton().jeton, genererJeton().jeton);
  });
});

describe("estChatPrive", () => {
  it("accepte un chat prive", () => {
    assert.equal(estChatPrive("123456789"), true);
  });

  it("refuse un groupe ou une valeur invalide", () => {
    assert.equal(estChatPrive("-100123456"), false);
    assert.equal(estChatPrive("0"), false);
    assert.equal(estChatPrive(""), false);
    assert.equal(estChatPrive("abc"), false);
  });
});
