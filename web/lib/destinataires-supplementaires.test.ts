import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validerDestinataires } from "./destinataires-supplementaires.ts";

describe("validerDestinataires", () => {
  it("accepte Telegram et WhatsApp, et nettoie le numero", () => {
    assert.deepEqual(
      validerDestinataires([
        { canal: "telegram", valeur: "-1001234" },
        { canal: "whatsapp", valeur: "+225 07 08-09.10.11" },
      ]),
      {
        liste: [
          { canal: "telegram", valeur: "-1001234" },
          { canal: "whatsapp", valeur: "+2250708091011" },
        ],
      },
    );
  });

  it("retire les doublons", () => {
    const r = validerDestinataires([
      { canal: "telegram", valeur: "42" },
      { canal: "telegram", valeur: "42" },
    ]);
    assert.deepEqual(r, { liste: [{ canal: "telegram", valeur: "42" }] });
  });

  it("refuse un numero de telephone comme chat Telegram invalide", () => {
    assert.ok("erreur" in validerDestinataires([{ canal: "telegram", valeur: "+225070809" }]));
    assert.ok("erreur" in validerDestinataires([{ canal: "whatsapp", valeur: "abc" }]));
    assert.ok("erreur" in validerDestinataires([{ canal: "sms", valeur: "123456789" }]));
  });

  it("limite la liste", () => {
    const trop = Array.from({ length: 6 }, (_, i) => ({ canal: "telegram", valeur: String(i + 1) }));
    assert.ok("erreur" in validerDestinataires(trop));
    assert.deepEqual(validerDestinataires(undefined), { liste: [] });
  });
});
