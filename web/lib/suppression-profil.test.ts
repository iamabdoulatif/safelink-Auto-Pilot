import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lignesDuPlan,
  nomSauvegarde,
  planSuppressionProfil,
} from "./suppression-profil-plan.ts";

// Plan de suppression : profil + tickets, désactivation uniquement.
describe("planSuppressionProfil", () => {
  const profils = [
    { ".id": "*1", name: "01-JOUR" },
    { ".id": "*2", name: "05-JOURS" },
  ];
  const users = [
    { ".id": "*a", profile: "01-JOUR", uptime: "0s" },
    { ".id": "*b", profile: "01-JOUR", uptime: "2h" },
    { ".id": "*c", profile: "05-JOURS", uptime: "0s" },
  ];

  it("compte neufs et utilisés du seul profil visé", () => {
    assert.deepEqual(planSuppressionProfil("01-JOUR", profils, users), {
      profilId: "*1", total: 2, neufs: 1, utilises: 1,
      idsTickets: ["*a", "*b"],
    });
    assert.equal(planSuppressionProfil("ABSENT", profils, users).profilId, null);
  });

  it("le plan commence par sauvegarde et filet, désactive puis supprime", () => {
    const plan = planSuppressionProfil("01-JOUR", profils, users);
    const lignes = lignesDuPlan(plan, "avant-suppression-x", "safelink-filet-1");
    assert.match(lignes[0], /backup\/save/);
    assert.match(lignes[1], /scheduler/);
    assert.match(lignes[2], /PATCH \/ip\/hotspot\/user\/\*a/);
    assert.ok(lignes.every((l) => !l.startsWith("PATCH /ip/hotspot/user/profile")));
    assert.ok(lignes.some((l) => l.startsWith("DELETE /ip/hotspot/user/")));
    assert.ok(lignes.at(-1)?.startsWith("DELETE /ip/hotspot/user/profile/"));
    assert.match(nomSauvegarde("01-JOUR", new Date("2026-11-06T00:00:00Z")),
      /^avant-suppression-01-JOUR-/);
  });
});
