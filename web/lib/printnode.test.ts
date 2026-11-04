import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  construireUrlWebhookPrintNode,
  validerEntreePrintNode,
  MESSAGES_WEBHOOK_PRINTNODE,
} from "./printnode.ts";

// Le webhook PrintNode est cree automatiquement avec trois parametres :
// url (APP_URL + chemin), secret, messages. L'URL doit etre exacte :
// une barre oblique de trop ou une base invalide et PrintNode appelle
// dans le vide. On ne demande que « print job state ».
describe("construireUrlWebhookPrintNode", () => {
  it("ajoute le chemin webhook a APP_URL", () => {
    assert.equal(
      construireUrlWebhookPrintNode("https://app.exemple.fr"),
      "https://app.exemple.fr/api/printnode/webhook",
    );
  });

  it("tolere la barre oblique finale et les espaces", () => {
    assert.equal(
      construireUrlWebhookPrintNode("  https://app.exemple.fr/  "),
      "https://app.exemple.fr/api/printnode/webhook",
    );
  });

  it("refuse une base vide ou sans http/https", () => {
    assert.equal(construireUrlWebhookPrintNode(""), null);
    assert.equal(construireUrlWebhookPrintNode("app.exemple.fr"), null);
  });

  it("ne demande que les etats d'impression", () => {
    assert.deepEqual([...MESSAGES_WEBHOOK_PRINTNODE], ["print job state"]);
  });
});

describe("validerEntreePrintNode", () => {
  it("accepte une entree complete", () => {
    assert.equal(validerEntreePrintNode("cle", 42, "HP LaserJet", "A4"), null);
  });

  it("refuse un identifiant d'imprimante invalide", () => {
    assert.match(
      validerEntreePrintNode("cle", 0, "HP", "A4") ?? "",
      /Identifiant d'imprimante invalide/,
    );
  });

  it("refuse un format papier inconnu", () => {
    assert.match(
      validerEntreePrintNode("cle", 42, "HP", "A3") ?? "",
      /Format papier inconnu/,
    );
  });
});
