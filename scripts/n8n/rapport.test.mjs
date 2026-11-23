import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

// Document joint : formulaire multipart envoyé en texte (le bac à sable de
// n8n sérialisait un Buffer en JSON et Telegram ne recevait aucun fichier).
const estDocument = (b) => typeof b === "string" && b.includes("Content-Type: text/csv");
const estHtml = (b) => typeof b === "string" && b.includes("Content-Type: text/html");

const empreinte = (code) => createHash("sha256").update(code, "utf8").digest("hex");

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
    routeur: { adresse: "https://routeur.test", utilisateur: "lecture", motDePasse: "x", variante: "sf-v1" },
    lotsVendeurs: [
      { lot: 101, numero_vendeur: "+22670000003" },
      { lot: 102, numero_vendeur: "+22670000004" },
    ],
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

describe("Rapport des ventes : source MikHmon (/system/script)", () => {
  it("compte exactement les ventes enregistrées par MikHmon, pas les tickets déjà utilisés", async () => {
    const base = fauxRouteur();
    const scripts = [
      { name: `${"nov/03/2026"}-|-08:10:00-|-a1-|-5000-|-ip-|-mac-|-1d-|-01-JOUR-|-vc-101-11.03.26` },
      { name: `2026-11-05-|-19:45:12-|-zz-|-10000-|-ip-|-mac-|-5d-|-05-JOURS-|-vc-102-11.05.26` },
      { name: `oct/25/2026-|-10:00:00-|-d1-|-5000-|-ip-|-mac-|-1d-|-01-JOUR-|-vc-099-10.25.26` },
    ];
    const routeur = { async httpRequest(o) {
      if (o.url.endsWith("/system/script")) { assert.equal(o.qs.comment, "mikhmon"); return scripts; }
      return base.httpRequest(o);
    } };
    const j = await executer("Calculer le rapport des ventes", CONFIG, [], routeur);
    assert.equal(j.sourceVentes, "mikhmon");
    assert.equal(j.ticketsVendus, 2); // la vente du 25/10 est hors période ; a2 et b1 « utilisés » ne comptent pas
    assert.equal(j.totalVendu, 15000);
    assert.deepEqual(j.ventes.map((v) => [v.ticket, v.date, v.heure]), [["a1", "2026-11-03", "08:10"], ["zz", "2026-11-05", "19:45"]]);
  });
});

describe("Rapport des ventes (cycle 00h à 00h)", () => {
  it("compte les tickets vendus du cycle et totalise par profil", async () => {
    const j = await executer("Calculer le rapport des ventes", CONFIG, [], fauxRouteur());
    assert.equal(j.ticketsVendus, 3);
    assert.equal(j.totalVendu, 20000); // 2 x 5 000 + 1 x 10 000
    assert.equal(j.montantFormate, "20 000 F");
    assert.deepEqual(j.parVendeur, [
      { numero: "+22670000003", tickets: 2, montant: 10000 },
      { numero: "+22670000004", tickets: 1, montant: 10000 },
    ]);
    assert.deepEqual(j.parProfil, [
      { profil: "01-JOUR", tickets: 2, prixUnitaire: 5000, montant: 10000, reste: 1 },
      { profil: "05-JOURS", tickets: 1, prixUnitaire: 10000, montant: 10000, reste: 0 },
    ]);
  });

  it("envoie texte + CSV au gérant/admin et les seules ventes de chaque vendeur (WhatsApp)", async () => {
    const calcule = await executer("Calculer le rapport des ventes", CONFIG, [], fauxRouteur());
    const appels = [];
    const j = await executer("Envoyer le rapport des ventes", calcule, appels, null);
    assert.equal(j.rapportEnvois, 4);
    const textes = appels.filter((a) => a.body && a.body.text);
    const documents = appels.filter((a) => estDocument(a.body));
    assert.equal(textes.length, 4);
    assert.equal(documents.length, 4);
    const rapportsHtml = appels.filter((a) => estHtml(a.body)).map((a) => a.body);
    assert.equal(rapportsHtml.length, 4, "un rapport mis en forme par destinataire");
    assert.match(rapportsHtml[0], /<table>/);
    assert.match(rapportsHtml[0], /Total vendu<\/small><b[^>]*>20 000 F/);
    const parNumero = new Map(textes.map((a) => [a.body.to, a.body.text]));
    assert.match(parNumero.get("+22670000002"), /Total vendu : 20 000 F/);
    assert.match(parNumero.get("+22670000002"), /01-JOUR : 2 vendus · 10 000 F · reste 1/);
    assert.match(parNumero.get("+22670000002"), /Par vendeur :/);
    assert.match(parNumero.get("+22670000002"), /rapport mis en forme et fichier \(Excel, Word ou CSV\) joints/);
    assert.match(parNumero.get("+22670000003"), /Vos tickets vendus : 2/);
    assert.match(parNumero.get("+22670000003"), /Votre total : 10 000 F/);
    assert.match(parNumero.get("+22670000004"), /Vos tickets vendus : 1/);
    const csvParNumero = new Map(documents.map((a) => {
      const corps = a.body.toString("utf8");
      const numero = /name="to"\r\n\r\n(\+\d+)/.exec(corps)?.[1];
      return [numero, corps];
    }));
    const csvGestion = csvParNumero.get("+22670000002");
    assert.match(csvGestion, /ticket;date de vente;heure de vente;profil/);
    assert.match(csvGestion, /a1;2026-11-03;—;01-JOUR;5000;\+22670000003/);
    assert.match(csvGestion, /TOTAL;3;;20000;/);
    const csvVendeur = csvParNumero.get("+22670000004");
    assert.match(csvVendeur, /b1;2026-11-05;—;05-JOURS;10000;\+22670000004/);
    assert.doesNotMatch(csvVendeur, /a1;/);
    assert.match(csvVendeur, /TOTAL;1;;10000;/);
  });

  it("rattache chaque vente à son heure relevée par le suivi de 15 min", async () => {
    const cfg = { data: { ...CONFIG.data,
      periode: { debut: "2026-11-05", fin: "2026-11-06" },
      ventesSuivi: [
        { ticketHash: empreinte("a1"), vuLe: "2026-11-05T08:42:00Z", heureConnue: true, lotDate: "2026-11-03" },
        { ticketHash: empreinte("a2"), vuLe: "2026-11-07T09:00:00Z", heureConnue: true, lotDate: "2026-11-03" },
      ] } };
    const j = await executer("Calculer le rapport des ventes", cfg, [], fauxRouteur());
    // a1 vendu le 05 à 08h42 (suivi), b1 le 05 (date du lot, sans
    // heure), a2 vu le 07 : hors journée, exclu.
    assert.equal(j.ticketsVendus, 2);
    assert.equal(j.totalVendu, 15000);
    assert.equal(j.ventesSansHeure, 1);
    assert.deepEqual(j.ventes.map((v) => [v.ticket, v.date, v.heure]), [
      ["a1", "2026-11-05", "08:42"],
      ["b1", "2026-11-05", ""],
    ]);
    const appels = [];
    await executer("Envoyer le rapport des ventes", j, appels, null);
    const textes = appels.filter((a) => a.body && a.body.text);
    assert.match(textes[0].body.text, /Rapport journalier des ventes/);
    assert.match(textes[0].body.text, /le 2026-11-05 \(00h à 00h\)/);
    const doc = appels.find((a) => estDocument(a.body)).body.toString("utf8");
    assert.match(doc, /a1;2026-11-05;08:42;01-JOUR;5000;/);
  });

  it("le relevé de 15 min n'envoie que l'empreinte des tickets utilisés", async () => {
    const cfg = { data: {
      tenantId: "t1", routerConnectionId: 7,
      routeur: { adresse: "https://routeur.test", utilisateur: "lecture", motDePasse: "x" },
    } };
    const j = await executer("Relever les tickets utilisés", cfg, [], fauxRouteur());
    assert.equal(j.tenantId, "t1");
    assert.equal(j.routerConnectionId, 7);
    assert.equal(j.tickets.length, 4); // c1 jamais utilisé : exclu
    const a1 = j.tickets.find((t) => t.hash === empreinte("a1"));
    assert.deepEqual(a1, { hash: empreinte("a1"), profil: "01-JOUR", lot: 101, lotDate: "2026-11-03" });
    assert.ok(j.tickets.every((t) => /^[0-9a-f]{64}$/.test(t.hash)));
  });

  it("en V3/V2 (lot unique), admin + gérant + vendeurs reçoivent le rapport complet", async () => {
    const cfgV3 = { data: { ...CONFIG.data, routeur: { ...CONFIG.data.routeur, variante: "v3" } } };
    const calcule = await executer("Calculer le rapport des ventes", cfgV3, [], fauxRouteur());
    assert.deepEqual(calcule.parVendeur, []); // pas de ventilation par vendeur en V3
    const appels = [];
    const j = await executer("Envoyer le rapport des ventes", calcule, appels, null);
    assert.equal(j.rapportEnvois, 4); // admin + gérant + 2 vendeurs
    assert.equal(appels.length, 12); // (texte + rapport mis en forme + CSV) × 4
    const destinataires = appels.filter((a) => a.body && a.body.to).map((a) => a.body.to);
    assert.deepEqual([...new Set(destinataires)].sort(),
      ["+22670000001", "+22670000002", "+22670000003", "+22670000004"]);
    const csvs = appels.filter((a) => estDocument(a.body)).map((a) => a.body.toString("utf8"));
    assert.equal(csvs.length, 4);
    assert.ok(csvs.every((c) => /TOTAL;3;;20000;/.test(c))); // tous : rapport complet de la zone
  });

  it("canal « les deux » : WhatsApp (numéros) et Telegram (chat) dans le même cycle", async () => {
    const calcule = await executer("Calculer le rapport des ventes",
      { data: { ...CONFIG.data, canal: "les_deux" } }, [], fauxRouteur());
    const appels = [];
    const j = await executer("Envoyer le rapport des ventes", calcule, appels, null);
    assert.ok(appels.some((a) => /sendMessage/.test(a.url || ""))); // Telegram au chat
    assert.ok(appels.some((a) => a.body && a.body.to === "+22670000001")); // WhatsApp admin
    assert.equal(j.rapportEnvois, 5); // 4 WhatsApp + 1 Telegram
  });

  it("envoie texte + CSV sur Telegram si la zone l'a choisi", async () => {
    const calcule = await executer("Calculer le rapport des ventes",
      { data: { ...CONFIG.data, canal: "telegram" } }, [], fauxRouteur());
    const appels = [];
    await executer("Envoyer le rapport des ventes", calcule, appels, null);
    assert.equal(appels.length, 3); // texte, rapport mis en forme, CSV
    assert.match(appels[0].url, /sendMessage/);
    assert.equal(appels[0].body.chat_id, "99");
    assert.match(appels[0].body.text, /Total vendu : 20 000 F/);
    assert.match(appels[1].url, /sendDocument/);
    assert.ok(estHtml(appels[1].body));
    assert.match(appels[1].body, /filename="rapport-ventes-2026-11-01\.html"/);
    assert.match(appels[2].body.toString("utf8"), /a1;2026-11-03;—;01-JOUR;5000;/);
  });
});
