import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normaliserCourriel, validerMotDePasse, validerProfil } from "./auth.ts";

// L'inscription verrouille le format AVANT tout acces base : le tenant
// derive du courriel normalise, jamais d'un en-tete client.
describe("normaliserCourriel", () => {
  it("minuscule et rogne les espaces", () => {
    assert.equal(normaliserCourriel("  Alice@Exemple.fr "), "alice@exemple.fr");
  });

  it("refuse les formats invalides", () => {
    assert.equal(normaliserCourriel(""), null);
    assert.equal(normaliserCourriel("pas-un-courriel"), null);
    assert.equal(normaliserCourriel("a@b"), null);
    assert.equal(normaliserCourriel("avec espace@exemple.fr"), null);
  });
});

describe("validerMotDePasse", () => {
  it("exige 12 caracteres minimum", () => {
    assert.equal(validerMotDePasse("court-123"), "12 caractères minimum.");
    assert.equal(validerMotDePasse("Assez-Long-1234"), null);
  });
});

describe("validerProfil", () => {
  it("accepte un profil complet et nettoie le numéro", () => {
    assert.deepEqual(
      validerProfil({ nom: " Bamba ", prenom: "Latif", pays: "Burkina Faso", numero: "+226 70-00-00-00" }),
      { nom: "Bamba", prenom: "Latif", pays: "Burkina Faso", numero: "+22670000000" },
    );
  });

  it("refuse un champ manquant ou un numéro trop court", () => {
    assert.match((validerProfil({ prenom: "Latif", pays: "Mali", numero: "70000000" }) as { erreur: string }).erreur, /Nom obligatoire/);
    assert.match((validerProfil({ nom: "Bamba", prenom: "Latif", pays: "Mali", numero: "123" }) as { erreur: string }).erreur, /Numéro obligatoire/);
    assert.match((validerProfil({ nom: "Bamba", prenom: "Latif", numero: "70000000" }) as { erreur: string }).erreur, /Pays obligatoire/);
  });
});
