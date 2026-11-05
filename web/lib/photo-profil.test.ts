import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detecterTypeImage } from "./photo-profil.ts";

describe("detecterTypeImage", () => {
  it("reconnait JPEG, PNG et WebP", () => {
    assert.equal(detecterTypeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(
      detecterTypeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    assert.equal(
      detecterTypeImage(new TextEncoder().encode("RIFF1234WEBPVP8 ")),
      "image/webp",
    );
  });

  it("refuse un SVG ou un contenu vide", () => {
    assert.equal(detecterTypeImage(new TextEncoder().encode("<svg onload='x'>")), null);
    assert.equal(detecterTypeImage(new Uint8Array()), null);
  });
});
