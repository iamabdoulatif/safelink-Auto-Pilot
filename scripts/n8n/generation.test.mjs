import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// n8n fournit require() aux nodes Code (modules autorises : crypto...).
const require = createRequire(import.meta.url);

// Simulation de « Générer les tickets dans RouterOS » (workflow Mikhmon)
// SANS aucun appel reseau : le code livre est execute tel quel, avec un
// routeur fictif en memoire (GET/PUT /rest/ip/hotspot/user).
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;

function chargerCode() {
  const doc = JSON.parse(
    readFileSync(join(RACINE, "n8n/workflows/workflow-mikhmon-patched.json"), "utf-8"),
  );
  const node = doc.nodes.find((n) => n.name === "Générer les tickets dans RouterOS");
  if (!node) throw new Error("Node introuvable.");
  return node.parameters.jsCode;
}

// Routeur fictif : tableau d'utilisateurs en memoire.
function fauxRouteur(utilisateurs, { echecPutAu = -1 } = {}) {
  let appelsPut = 0;
  return {
    appelsPut: () => appelsPut,
    utilisateurs,
    async httpRequest({ method, url, body }) {
      if (!url.includes("/rest/ip/hotspot/user")) {
        throw new Error("URL inattendue en simulation : " + url);
      }
      if (method === "GET") return utilisateurs.map((u) => ({ ...u }));
      appelsPut++;
      if (appelsPut === echecPutAu) throw new Error("503 routeur simule en panne");
      utilisateurs.push({
        name: body.name,
        password: body.password,
        profile: body.profile,
        comment: body.comment,
        disabled: false,
        uptime: "0s",
      });
      return { name: body.name };
    },
  };
}

function configurer(runId, extra = {}) {
  return {
    routerBaseUrl: "https://routeur.test",
    routerUser: "n8n-vouchers",
    routerPassword: "mot-de-passe-fictif",
    quantity: 3,
    prefix: "3j",
    usernameLength: 8,
    passwordLength: 8,
    profile: "03-JOURS",
    hotspotServer: "all",
    tenantId: "tenant-simule",
    cleIdempotence: runId,
    limitUptime: "",
    limitBytesTotal: "",
    ...extra,
  };
}

async function executer(cfg, routeur) {
  const $input = { all: () => [{ json: cfg }] };
  const $env = {};
  const contexte = { helpers: { httpRequest: (o) => routeur.httpRequest(o) } };
  const fn = new AsyncFunction("$input", "$env", "require", chargerCode());
  const sorties = await fn.call(contexte, $input, $env, require);
  return sorties[0].json;
}

describe("Générer les tickets (simulation)", () => {
  it("idempotence : un run rejoue ne recree aucun ticket", async () => {
    const utilisateurs = [
      { name: "3jancien", profile: "03-JOURS", disabled: false, uptime: "0s", comment: "x cle:RUN9 y" },
    ];
    const routeur = fauxRouteur(utilisateurs);
    const resultat = await executer(configurer("RUN9"), routeur);
    assert.equal(resultat.dejaGenere, true);
    assert.equal(resultat.tickets.length, 0);
    assert.equal(routeur.appelsPut(), 0);
    assert.equal(utilisateurs.length, 1);
  });

  it("echec partiel : arret immediat, nombre reel conserve", async () => {
    const utilisateurs = [];
    const routeur = fauxRouteur(utilisateurs, { echecPutAu: 2 });
    await assert.rejects(() => executer(configurer("RUN10"), routeur), /1 ticket\(s\) déjà créé/);
    assert.equal(utilisateurs.length, 1);
  });

  it("identifiants et mots de passe imprevisibles (CSPRNG)", async () => {
    const r1 = await executer(configurer("RUN11"), fauxRouteur([]));
    const r2 = await executer(configurer("RUN12"), fauxRouteur([]));
    const codes = [...r1.tickets, ...r2.tickets].map((t) => t.username + t.password);
    assert.equal(codes.length, 6);
    for (const c of codes) assert.match(c, /^[23456789abcdefghijkmnpqrstuvwxyz]+$/);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("echappe le HTML (profil et identifiants)", async () => {
    const utilisateurs = [];
    const routeur = fauxRouteur(utilisateurs);
    const resultat = await executer(
      configurer("RUN13", { profile: "03-JOURS", prefix: "3j" }),
      routeur,
    );
    assert.ok(resultat.html.includes("&lt;") === false);
    for (const t of resultat.tickets) {
      assert.ok(!/[<>&"']/.test(t.username));
      assert.ok(!/[<>&"']/.test(t.password));
    }
  });
});
