import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { versFormulaireMikhmon } = await import("./safelinkhub-import.ts");

const r = { id: "1", name: "HSPT-ADJA", online: true, tunnelIp: "10.66.0.73", model: null, mikhmonVariant: "sf-v1" as const, routerosUrl: "http://10.66.0.73:85", mikhmonUrl: "http://10.66.0.73:8089/admin.php?id=login" };

describe("import SafeLinkHub", () => {
  it("remplit hôte et port Mikhmon par le tunnel", () => {
    assert.deepEqual(versFormulaireMikhmon(r), { nom: "HSPT-ADJA", variante: "sf-v1", hote: "10.66.0.73", port: "8089" });
  });
  it("instance cloud https : hôte laissé vide", () => {
    const f = versFormulaireMikhmon({ ...r, mikhmonVariant: "v3", mikhmonUrl: "https://m1.safelinkhub.io/admin.php?id=login" });
    assert.equal(f.hote, "");
    assert.equal(f.variante, "v3");
  });
});
