import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  badBlocksCroissants,
  fcsCroissantes,
  linkDownsRepetes,
  memoireFaible,
  parseUptime,
  redemarrageSpontane,
  temperatureHaute,
  type ReleveCompare,
} from "./variation.ts";

// Un releve synthetique, sans reseau ni base : deux objets suffisent.
function releve(
  minutesApres: number,
  donnees: Record<string, unknown>,
): ReleveCompare {
  return {
    mesureLe: new Date(
      Date.UTC(2026, 0, 1, 0, 0, 0) + minutesApres * 60000,
    ),
    donnees,
  };
}

function ressource(
  uptime: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uptime,
    "cpu-load": 20,
    "free-memory": 8000000,
    "total-memory": 10000000,
    "bad-blocks": 0,
    ...extra,
  };
}

describe("parseUptime", () => {
  it("lit les durees RouterOS", () => {
    assert.equal(parseUptime("5m"), 300);
    assert.equal(parseUptime("2d3h"), 2 * 86400 + 3 * 3600);
    assert.equal(parseUptime("1w2d3h4m5s"), 788645);
    assert.equal(parseUptime("04:12:33"), 4 * 3600 + 12 * 60 + 33);
  });
  it("rend null quand illisible", () => {
    assert.equal(parseUptime(undefined), null);
    assert.equal(parseUptime("n'importe quoi"), null);
    assert.equal(parseUptime(""), null);
  });
});

describe("redemarrageSpontane", () => {
  it("detecte un uptime qui recule", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d3h4m"),
    });
    const apres = releve(60, {
      "system/resource": ressource("5m"),
    });
    const trouve = redemarrageSpontane(avant, apres);
    assert.ok(trouve, "un constat est attendu");
    assert.equal(trouve.regle, "materiel.redemarrage-spontane");
    assert.equal(trouve.gravite, "critique");
    assert.equal(trouve.categorie, "materiel");
  });
  it("reste muet sans redemarrage", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d3h"),
    });
    const apres = releve(60, {
      "system/resource": ressource("2d4h"),
    });
    assert.equal(redemarrageSpontane(avant, apres), null);
  });
  it("reste muet quand l'uptime est absent", () => {
    const avant = releve(0, { "system/resource": {} });
    const apres = releve(60, { "system/resource": {} });
    assert.equal(redemarrageSpontane(avant, apres), null);
  });
});

describe("fcsCroissantes", () => {
  const stats = (fcs: string) => [
    { name: "ether3", "rx-fcs-error": fcs },
  ];
  it("signale plus de 10 erreurs par minute", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d3h"),
      "interface/ethernet:stats": stats("0"),
    });
    const apres = releve(60, {
      "system/resource": ressource("2d4h"),
      "interface/ethernet:stats": stats("720"),
    });
    const trouve = fcsCroissantes(avant, apres);
    assert.ok(trouve, "un constat est attendu");
    assert.equal(trouve.gravite, "majeure");
    assert.equal(trouve.cible, "ether3");
  });
  it("reste muet sans redemarrage intercale", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d3h"),
      "interface/ethernet:stats": stats("0"),
    });
    const apres = releve(60, {
      "system/resource": ressource("5m"),
      "interface/ethernet:stats": stats("720"),
    });
    assert.equal(fcsCroissantes(avant, apres), null);
    assert.ok(redemarrageSpontane(avant, apres), "le reboot est signale");
  });
  it("reste muet quand le compteur est absent", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d3h"),
      "interface/ethernet:stats": [{ name: "ether3" }],
    });
    const apres = releve(60, {
      "system/resource": ressource("2d4h"),
      "interface/ethernet:stats": [{ name: "ether3" }],
    });
    assert.equal(fcsCroissantes(avant, apres), null);
  });
});

describe("linkDownsRepetes", () => {
  const ifaces = (downs: number) => [
    { name: "ether3", "link-downs": downs },
  ];
  it("signale plus de 5 coupures par 24 h", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d"),
      interface: ifaces(0),
    });
    const apres = releve(1440, {
      "system/resource": ressource("3d"),
      interface: ifaces(6),
    });
    const trouve = linkDownsRepetes(avant, apres);
    assert.ok(trouve, "un constat est attendu");
    assert.equal(trouve.gravite, "majeure");
  });
  it("reste muet sur un intervalle trop court", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d"),
      interface: ifaces(0),
    });
    const apres = releve(30, {
      "system/resource": ressource("2d"),
      interface: ifaces(6),
    });
    assert.equal(linkDownsRepetes(avant, apres), null);
  });
});

describe("temperatureHaute", () => {
  it("signale au-dela de 70 C", () => {
    const avant = releve(0, {
      "system/health": [{ name: "temperature", value: 68 }],
    });
    const apres = releve(60, {
      "system/health": [{ name: "temperature", value: 75 }],
    });
    const trouve = temperatureHaute(avant, apres);
    assert.ok(trouve, "un constat est attendu");
    assert.equal(trouve.gravite, "majeure");
  });
  it("reste muet quand la sante est absente", () => {
    const avant = releve(0, {});
    const apres = releve(60, {});
    assert.equal(temperatureHaute(avant, apres), null);
  });
});

describe("memoireFaible", () => {
  it("signale sous 10 % de memoire libre", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d", { "free-memory": 800000 }),
    });
    const apres = releve(60, {
      "system/resource": ressource("2d", { "free-memory": 500000 }),
    });
    const trouve = memoireFaible(avant, apres);
    assert.ok(trouve, "un constat est attendu");
    assert.equal(trouve.gravite, "majeure");
  });
  it("reste muet sans total memoire", () => {
    const avant = releve(0, {
      "system/resource": { uptime: "2d", "free-memory": 100 },
    });
    const apres = releve(60, {
      "system/resource": { uptime: "2d", "free-memory": 50 },
    });
    assert.equal(memoireFaible(avant, apres), null);
  });
});

describe("badBlocksCroissants", () => {
  it("signale toute augmentation", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d", { "bad-blocks": 0 }),
    });
    const apres = releve(60, {
      "system/resource": ressource("2d", { "bad-blocks": 2 }),
    });
    const trouve = badBlocksCroissants(avant, apres);
    assert.ok(trouve, "un constat est attendu");
    assert.equal(trouve.gravite, "majeure");
  });
  it("reste muet quand le compteur stagne", () => {
    const avant = releve(0, {
      "system/resource": ressource("2d", { "bad-blocks": 1 }),
    });
    const apres = releve(60, {
      "system/resource": ressource("2d", { "bad-blocks": 1 }),
    });
    assert.equal(badBlocksCroissants(avant, apres), null);
  });
});
