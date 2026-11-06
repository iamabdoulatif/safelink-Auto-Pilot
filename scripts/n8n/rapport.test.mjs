import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;

function codeDe(nom) {
  const doc = JSON.parse(
    readFileSync(join(RACINE, "n8n/workflows/workflow-mikhmon-patched.json"), "utf-8"),
  );
  const node = doc.nodes.find((n) => n.name === nom);
  if (!node) throw new Error("Node introuvable : " + nom);
  return node.parameters.jsCode;
}

const CONFIG = {
  data: {
    rapportId: "r1", tenantId: "t1",
    periode: { debut: "2026-11-01", fin: "2026-11-11" },
    canal: "whatsapp",
    zone: {
      nom: "HSPT-MOSQUEE-ADJA", localisation: "Mosquée", commune: "Ouaga",
      numeroAdmin: "+22670000001", numeroGerant: "+22670000002",
      numerosVendeurs: ["+22670000003", "+22670000004"],
    },
    routeur: { adresse: "https://routeur.test", utilisateur: "lecture", motDePasse: "x" },
    canaux: {
      telegramChatId: "99", telegramBotToken: "jeton",
      whatsappWebhookUrl: "https://adaptateur.test/hook",
    },
  },
};

function fauxRouteur() {
  const users = [
    // vendus dans la période (lot du 03/11), profils et prix différents
    { name: "a1", profile: "01-JOUR", uptime: "1h", comment: "vc-101-11.03.26" },
    { name: "a2", profile: "01-JOUR", uptime: "2h", comment: "vc-101-11.03.26" },
    { name: "b1", profile: "05-JOURS", uptime: "1d", comment: "vc-102-11.05.26" },
    // neuf (jamais utilisé) : pas une vente
    { name: "c1", profile: "01-JOUR", uptime: "0s", comment: "vc-101-11.03.26" },
    // vendu hors période (lot du 25/10)
    { name: "d1", profile: "01-JOUR", uptime: "3h", comment: "vc-099-10.25.26" },
  ];
  const profs = [
    { name: "01-JOUR", "on-login": "0,0,0,,5000," },
    { name: "05-JOURS", "on-login": "0,0,0,,10000," },
  ];
  return { async httpRequest({ url }) {
    if (url.endsWith("/user/profile")) return profs;
    if (url.endsWith("/user")) return users;
    throw new Error("URL inattendue : " + url);
  } };
}

async function executer(nom, cfg, appels, routeur) {
  const $input = {
    all: () => [{ json: cfg }],
    first: () => ({ json: cfg }),
  };
  const contexte = { helpers: {
    httpRequest: routeur
      ? (o) => routeur.httpRequest(o)
      : async (o) => { appels.push(o); return { ok: true }; },
  } };
  const fn = new AsyncFunction("$input", "$env", "require", "$", codeDe(nom));
  const $ = () => ({ first: () => ({ json: { appUrl: "https://app.test" } }) });
  const sorties = await fn.call(contexte, $input, {}, require, $);
  return sorties[0].json;
}

describe("Rapport des ventes (cycle 00h à 00h)", () => {
  it("compte les tickets vendus du cycle et totalise par profil", async () => {
    const j = await executer("Calculer le rapport des ventes", CONFIG, [], fauxRouteur());
    assert.equal(j.ticketsVendus, 3);
    assert.equal(j.totalVendu, 20000); // 2 x 5 000 + 1 x 10 000
    assert.equal(j.montantFormate, "20 000 F");
    assert.deepEqual(j.parProfil, [
      { profil: "01-JOUR", tickets: 2, prixUnitaire: 5000, montant: 10000 },
      { profil: "05-JOURS", tickets: 1, prixUnitaire: 10000, montant: 10000 },
    ]);
  });

  it("envoie le complet au gérant/admin et le résumé aux vendeurs (WhatsApp)", async () => {
    const calcule = await executer("Calculer le rapport des ventes", CONFIG, [], fauxRouteur());
    const appels = [];
    const j = await executer("Envoyer le rapport des ventes", calcule, appels, null);
    assert.equal(j.rapportEnvois, 4);
    const parNumero = new Map(appels.map((a) => [a.body.to, a.body.text]));
    assert.match(parNumero.get("+22670000002"), /Total vendu : 20 000 F/);
    assert.match(parNumero.get("+22670000002"), /01-JOUR : 2 tickets/);
    assert.match(parNumero.get("+22670000003"), /Point de votre zone/);
    assert.match(parNumero.get("+22670000004"), /Tickets vendus : 3/);
  });

  it("envoie le rapport complet sur Telegram si la zone l'a choisi", async () => {
    const calcule = await executer("Calculer le rapport des ventes",
      { data: { ...CONFIG.data, canal: "telegram" } }, [], fauxRouteur());
    const appels = [];
    await executer("Envoyer le rapport des ventes", calcule, appels, null);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].body.chat_id, "99");
    assert.match(appels[0].body.text, /Total vendu : 20 000 F/);
  });
});
