import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EntreeRouteur } from "./connexions-routeur.ts";

// Regression 42P08 : enregistrer sans mot de passe de lecture faisait
// echouer PostgreSQL ("could not determine data type of parameter $8")
// car le parametre nullable etait enferme dans un CASE sans type.
// Le correctif caste $8::text ; ce test exerce les deux branches.
// La partie base suit la convention du projet (scripts/test-base.mjs) :
// elle ne tourne que si SAFELINK_TEST_DATABASE_URL est defini, et
// DATABASE_URL est aligne dessus avant tout import du module teste.
const urlTest = process.env.SAFELINK_TEST_DATABASE_URL ?? "";
if (urlTest) process.env.DATABASE_URL = urlTest;

const {
  validerEntreeRouteur,
  enregistrerConnexionRouteur,
  lireMotDePasseLecture,
} = await import("./connexions-routeur.ts");

const entreeValide: EntreeRouteur = {
  adresseRouterOS: "https://routeur.exemple.fr:61214",
  utilisateurLecture: "app-audit",
  motDePasseLecture: "",
  utilisateurCorrection: "app-fix",
  motDePasseCorrection: "MotDePasse-Correction-Test-1",
  serveurHotspot: "",
};

describe("validerEntreeRouteur", () => {
  it("accepte une entree complete", () => {
    assert.equal(validerEntreeRouteur(entreeValide), null);
  });

  it("refuse une adresse sans http/https", () => {
    const e = { ...entreeValide, adresseRouterOS: "routeur.exemple.fr" };
    assert.match(validerEntreeRouteur(e) ?? "", /Adresse RouterOS invalide/);
  });
});

describe("enregistrerConnexionRouteur (base de test)", () => {
  it(
    "enregistre avec mot de passe de lecture vide puis fourni",
    { skip: urlTest ? false : "SAFELINK_TEST_DATABASE_URL non defini" },
    async () => {
      const { db } = await import("./db.ts");
      const tenantId = "test-connexions-routeur@exemple.fr";
      const ctx = { tenantId, utilisateurId: "test-connexions-routeur" };
      await db.query(
        "DELETE FROM configurations_routeurs WHERE tenant_id=$1",
        [tenantId],
      );
      await db.query("DELETE FROM espaces WHERE tenant_id=$1", [tenantId]);
      try {
        await db.query(
          "INSERT INTO espaces (tenant_id, utilisateur_id) VALUES ($1,$2)",
          [tenantId, ctx.utilisateurId],
        );
        const { rows } = await db.query(
          `INSERT INTO configurations_routeurs
             (tenant_id, utilisateur_id, nom, variante_mikhmon, url_mikhmon,
              identifiant_mikhmon, mot_de_passe_mikhmon_chiffre,
              adresse_routeros, utilisateur_lecture, utilisateur_correction,
              mot_de_passe_correction_chiffre)
           VALUES ($1,$2,'test-connexions-routeur','v3','http://test.local',
              'test','v1:test','','','', 'v1:test')
           RETURNING id`,
          [tenantId, ctx.utilisateurId],
        );
        const id = (rows as { id: number }[])[0].id;

        // Branche $8 NULL (le bug 42P08) : doit reussir et ne rien imposer.
        const sansLecture = await enregistrerConnexionRouteur(ctx, id, {
          ...entreeValide,
          motDePasseLecture: "",
        });
        assert.ok("connexion" in sansLecture, JSON.stringify(sansLecture));
        assert.equal(await lireMotDePasseLecture(ctx, id), null);

        // Branche $8 fourni : le mot de passe est stocke (chiffre).
        const avecLecture = await enregistrerConnexionRouteur(ctx, id, {
          ...entreeValide,
          motDePasseLecture: "MotDePasse-Lecture-Test-1",
        });
        assert.ok("connexion" in avecLecture, JSON.stringify(avecLecture));
        assert.equal(
          await lireMotDePasseLecture(ctx, id),
          "MotDePasse-Lecture-Test-1",
        );

        // Vide a nouveau : l'ancien mot de passe est conserve.
        const revide = await enregistrerConnexionRouteur(ctx, id, {
          ...entreeValide,
          motDePasseLecture: "",
        });
        assert.ok("connexion" in revide, JSON.stringify(revide));
        assert.equal(
          await lireMotDePasseLecture(ctx, id),
          "MotDePasse-Lecture-Test-1",
        );
      } finally {
        await db.query(
          "DELETE FROM configurations_routeurs WHERE tenant_id=$1",
          [tenantId],
        );
        await db.query("DELETE FROM espaces WHERE tenant_id=$1", [tenantId]);
        await db.end();
      }
    },
  );
});
