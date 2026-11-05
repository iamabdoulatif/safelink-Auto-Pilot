import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DUREE_SESSION_SECONDES,
  emissionSession,
  resoudreContexte,
  signerSession,
  verifierSession,
} from "./session-cookie.ts";

// Un client peut envoyer n'importe quels en-tetes : x-tenant-id,
// x-user-id et l'ancien cookie sl_tenant ne doivent JAMAIS decider
// de l'identite. Seul le cookie de session signe compte.
const SECRET = "secret-de-test-32-octets-minimum!!";
const AUTRE_SECRET = "un-autre-secret-de-test-32-octets!";

describe("resoudreContexte", () => {
  it("ignore les en-tetes falsifies sans cookie de session", () => {
    const ctx = resoudreContexte(null, SECRET);
    assert.equal(ctx, null);
  });

  it("retrouve le tenant du cookie signe, pas celui des en-tetes", () => {
    const cookie = signerSession(SECRET, {
      utilisateurId: "alice@exemple.fr",
      tenantId: "alice@exemple.fr",
    });
    const ctx = resoudreContexte(cookie, SECRET);
    assert.equal(ctx?.tenantId, "alice@exemple.fr");
    assert.equal(ctx?.utilisateurId, "alice@exemple.fr");
  });

  it("refuse un cookie falsifie meme avec des en-tetes coherents", () => {
    const cookie = signerSession(SECRET, {
      utilisateurId: "alice@exemple.fr",
      tenantId: "alice@exemple.fr",
    });
    const fausseCharge = Buffer.from(
      JSON.stringify({
        v: 1,
        uid: "bob@exemple.fr",
        tenant: "bob@exemple.fr",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const falsifie = fausseCharge + "." + cookie.split(".")[1];
    assert.equal(verifierSession(SECRET, falsifie), null);
    assert.equal(resoudreContexte(falsifie, SECRET), null);
  });

  it("refuse un cookie expire", () => {
    const cookie = signerSession(
      SECRET,
      { utilisateurId: "alice@exemple.fr", tenantId: "alice@exemple.fr" },
      { dureeSecondes: -10 },
    );
    assert.equal(verifierSession(SECRET, cookie), null);
  });

  it("refuse un cookie signe avec un autre secret", () => {
    const cookie = signerSession(AUTRE_SECRET, {
      utilisateurId: "alice@exemple.fr",
      tenantId: "alice@exemple.fr",
    });
    assert.equal(verifierSession(SECRET, cookie), null);
  });

  it("refuse un cookie malforme", () => {
    assert.equal(verifierSession(SECRET, ""), null);
    assert.equal(verifierSession(SECRET, "nimporte-quoi"), null);
    assert.equal(verifierSession(SECRET, "a.b.c"), null);
  });
});

describe("emissionSession", () => {
  it("retrouve la date d'emission depuis l'echeance", () => {
    const valeur = signerSession(
      SECRET,
      { utilisateurId: "a@b.fr", tenantId: "a@b.fr" },
      { maintenantSec: 1000, dureeSecondes: DUREE_SESSION_SECONDES },
    );
    assert.equal(emissionSession(valeur), 1000);
  });
});
