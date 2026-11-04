import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Simulation du routage Telegram SANS aucun appel reseau : le code du
// node « Aiguiller » est execute tel quel (extrait du workflow livre),
// avec $input/$env/this.helpers simules. httpRequest simule echoue
// toujours : le routage ne doit jamais en dependre.
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;

function chargerAiguillage() {
  const doc = JSON.parse(
    readFileSync(join(RACINE, "n8n/workflows/workflow-telegram-tickets.json"), "utf-8"),
  );
  const node = doc.nodes.find((n) => n.name === "Aiguiller");
  if (!node) throw new Error("Node Aiguiller introuvable.");
  return node.parameters.jsCode;
}

function chargerWorkflow() {
  return JSON.parse(
    readFileSync(join(RACINE, "n8n/workflows/workflow-telegram-tickets.json"), "utf-8"),
  );
}

async function router(entree) {
  const code = chargerAiguillage();
  const $input = { first: () => ({ json: entree }), all: () => [{ json: entree }] };
  const $env = {};
  const contexte = {
    helpers: {
      httpRequest: async () => {
        throw new Error("Reseau interdit en simulation.");
      },
    },
  };
  const fn = new AsyncFunction("$input", "$env", code);
  const sorties = await fn.call(contexte, $input, $env);
  return sorties[0].json;
}

const message = (text) => ({ message: { text, chat: { id: 111 }, from: { id: 222 } } });
const rappel = (data, id = "cb-1") => ({
  callback_query: { data, id, from: { id: 222 }, message: { chat: { id: 111 } } },
});

describe("Aiguiller (simulation)", () => {
  it("traite /start et /tickets vers les routeurs (jamais de profils en dur)", async () => {
    assert.equal((await router(message("/start"))).route, "askRouters");
    assert.equal((await router(message("/tickets"))).route, "askRouters");
  });

  it("ne devine aucun profil depuis le texte (RouterOS decide)", async () => {
    for (const saisie of ["3 jours", "7 jours", "30 jours", "03-JOURS", "bonjour"]) {
      assert.equal((await router(message(saisie))).route, "help");
    }
  });

  it("traite le clic sur un routeur (callback routeur:<id>)", async () => {
    const r = await router(rappel("routeur:7"));
    assert.equal(r.route, "askProfiles");
    assert.equal(r.routerId, 7);
    assert.equal(r.callbackQueryId, "cb-1");
  });

  it("traite le clic sur un profil (callback prof:<routeur>:<profil>)", async () => {
    const r = await router(rappel("prof:7:Mon-Profil"));
    assert.equal(r.route, "askQty");
    assert.equal(r.routerId, 7);
    assert.equal(r.profile, "Mon-Profil");
    assert.equal(r.callbackQueryId, "cb-1");
  });

  it("traite le clic sur une quantite (callback qty:<routeur>:<profil>:<qty>)", async () => {
    const r = await router(rappel("qty:7:Mon-Profil:240"));
    assert.equal(r.route, "generate");
    assert.equal(r.routerId, 7);
    assert.equal(r.profile, "Mon-Profil");
    assert.equal(r.qty, 240);
  });

  it("callback invalide : accuse l'erreur au lieu du silence", async () => {
    for (const donnees of ["routeur:xx", "routeur:0", "prof:7:", "prof:INCONNU", "qty:7:Mon-Profil:999", "qty:03-JOURS:240", "nimporte-quoi"]) {
      const r = await router(rappel(donnees));
      assert.equal(r.route, "ackErreur");
      assert.equal(r.errorText, "Erreur de sélection.");
      assert.equal(r.callbackQueryId, "cb-1");
    }
  });

  it("quantite sans profil : message exact demande", async () => {
    const r = await router(message("240"));
    assert.equal(r.route, "help");
    assert.equal(r.errorCode, "QUANTITE_SANS_PROFIL");
  });

  it("traite un message classique inconnu sans planter", async () => {
    const r = await router(message("bonjour"));
    assert.equal(r.route, "help");
  });

  it("signale une quantite sans profil au lieu de generer", async () => {
    const r = await router(message("120"));
    assert.equal(r.route, "help");
    assert.equal(r.errorCode, "QUANTITE_SANS_PROFIL");
  });

  it("aucune liste statique de profils dans le workflow", async () => {
    const brut = readFileSync(
      join(RACINE, "n8n/workflows/workflow-telegram-tickets.json"), "utf-8",
    );
    for (const statique of ["03-JOURS", "01-SEMAINE", "01-MOIS", "NORMALISER_PROFIL"]) {
      assert.ok(!brut.includes(statique), "statique résiduel : " + statique);
    }
  });

  it("le workflow appelle le catalogue puis autoriser avec le routerId", async () => {
    const doc = chargerWorkflow();
    const codes = Object.fromEntries(
      doc.nodes
        .filter((n) => n.type === "n8n-nodes-base.code")
        .map((n) => [n.name, n.parameters.jsCode ?? ""]),
    );
    assert.ok(codes["Lister les routeurs"].includes("/api/telegram/catalogue"));
    assert.ok(codes["Proposer les profils"].includes("/api/telegram/catalogue"));
    assert.ok(codes["Vérifier l'utilisateur"].includes("/api/telegram/autoriser"));
    assert.ok(codes["Vérifier l'utilisateur"].includes("routerId"));
    assert.ok(!codes["Vérifier l'utilisateur"].includes("TELEGRAM_ALLOWED_ID"));
  });
});
