import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  destinatairesZone,
  fusionnerDestinataires,
  nettoyerNumero,
  validerZoneWifi,
} from "./zones-wifi-validation.ts";

// Fiche d'une zone Wi-Fi : localisation, commune et numéros
// admin / gérant / vendeurs renseignés depuis le SaaS.
describe("validerZoneWifi", () => {
  it("accepte une fiche complète et nettoie les numéros", () => {
    const r = validerZoneWifi({
      localisation: "Marché central, box 12",
      commune: "Ouagadougou",
      numeroAdmin: "+226 70-00-00-01",
      numeroGerant: "+22670000002",
      numerosVendeurs: ["+226 70 00 00 03", "+22670000003", ""],
    });
    assert.deepEqual(r, {
      zone: {
        localisation: "Marché central, box 12",
        commune: "Ouagadougou",
        numeroAdmin: "+22670000001",
        numeroGerant: "+22670000002",
        numerosVendeurs: ["+22670000003"],
        rapportActif: false, rapportCanal: "telegram",
        rapportPlanification: "decade", rapportDebut: "",
        rapportFin: "", rapportDateEnvoi: "",
        latitude: null, longitude: null, wifiNom: "",
        prixProfils: [],
      },
    });
  });

  it("refuse un numéro invalide et une fiche sans aucun numéro", () => {
    assert.ok("erreur" in validerZoneWifi({ numeroAdmin: "123" }));
    assert.ok("erreur" in validerZoneWifi({ numerosVendeurs: ["abc"] }));
    assert.ok("erreur" in validerZoneWifi({ localisation: "Ici" }));
  });

  it("valide le nom du Wi-Fi et les prix par profil", () => {
    const ok = validerZoneWifi({
      numeroAdmin: "+22670000001", wifiNom: "SafeLink-Mosquée",
      prixProfils: [
        { profil: "01-JOUR", prix: 500 },
        { profil: "01-JOUR", prix: 500 },
        { profil: "05-JOURS", prix: "2000" },
      ],
    });
    assert.ok("zone" in ok);
    if ("zone" in ok) {
      assert.deepEqual(ok.zone.prixProfils, [
        { profil: "01-JOUR", prix: 500 },
        { profil: "05-JOURS", prix: 2000 },
      ]);
    }
    assert.ok("erreur" in validerZoneWifi({
      numeroAdmin: "+22670000001",
      prixProfils: [{ profil: "01-JOUR", prix: -5 }],
    }));
  });

  it("exige latitude et longitude ensemble, dans les limites", () => {
    assert.ok("erreur" in validerZoneWifi({
      numeroAdmin: "+22670000001", latitude: 12.37,
    }));
    assert.ok("erreur" in validerZoneWifi({
      numeroAdmin: "+22670000001", latitude: 95, longitude: -1.5,
    }));
    const ok = validerZoneWifi({
      numeroAdmin: "+22670000001", latitude: "12.3714", longitude: -1.5197,
    });
    assert.ok("zone" in ok && ok.zone.latitude === 12.3714);
  });

  it("refuse une période personnalisée incohérente", () => {
    assert.ok("erreur" in validerZoneWifi({
      numeroAdmin: "+22670000001", rapportActif: true,
      rapportPlanification: "personnalise",
      rapportDebut: "2026-11-10", rapportFin: "2026-11-01",
    }));
    const ok = validerZoneWifi({
      numeroAdmin: "+22670000001", rapportActif: true,
      rapportPlanification: "personnalise",
      rapportDebut: "2026-11-01", rapportFin: "2026-11-10",
    });
    assert.ok("zone" in ok && ok.zone.rapportDebut === "2026-11-01");
  });

  it("limite le nombre de vendeurs", () => {
    const vendeurs = Array.from({ length: 6 }, (_, i) => `+2267000001${i}`);
    assert.ok("erreur" in validerZoneWifi({ numerosVendeurs: vendeurs }));
  });
});

describe("destinatairesZone et fusion", () => {
  it("déduplique admin, gérant et vendeurs", () => {
    assert.deepEqual(
      destinatairesZone({
        numeroAdmin: "+22670000001",
        numeroGerant: "+22670000001",
        numerosVendeurs: ["+22670000002", "+22670000002"],
      }),
      [
        { canal: "whatsapp", valeur: "+22670000001" },
        { canal: "whatsapp", valeur: "+22670000002" },
      ],
    );
    assert.equal(nettoyerNumero("  +226 70.00.00.01 "), "+22670000001");
    assert.equal(nettoyerNumero("0700"), null);
  });

  it("fusionne sans doublon avec les destinataires d'une règle", () => {
    assert.deepEqual(
      fusionnerDestinataires(
        [{ canal: "whatsapp", valeur: "+22670000001" }],
        [
          { canal: "whatsapp", valeur: "+22670000001" },
          { canal: "telegram", valeur: "42" },
        ],
      ),
      [
        { canal: "whatsapp", valeur: "+22670000001" },
        { canal: "telegram", valeur: "42" },
      ],
    );
  });
});
