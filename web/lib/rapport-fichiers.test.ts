import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";

const { fichierRapport, genererCsv, resumeParProfil } = await import("./rapport-fichiers.ts");

const d = {
  titre: "Rapport journalier des ventes", zone: "HSPT-MOSQUEE-ADJA", periode: "le 2026-11-22 (00h à 00h)", debut: "2026-11-22",
  ventes: [
    { ticket: "1m832874", date: "2026-11-22", heure: "05:30", profil: "01-MOIS", prix: 2000, vendeur: "" },
    { ticket: "5j367932", date: "2026-11-22", heure: "13:48", profil: "05-JOURS", prix: 500, vendeur: "" },
    { ticket: "5j779949", date: "2026-11-22", heure: "16:36", profil: "05-JOURS", prix: 500, vendeur: "" },
    { ticket: "5j443469", date: "2026-11-22", heure: "19:46", profil: "05-JOURS", prix: 500, vendeur: "" },
  ],
  reste: { "01-MOIS": 126, "05-JOURS": 294 },
};

// Lecture minimale d'un ZIP (entrées locales) pour vérifier le .xlsx.
function lireZip(b: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let o = 0;
  while (b.readUInt32LE(o) === 0x04034b50) {
    const comp = b.readUInt32LE(o + 18), lnom = b.readUInt16LE(o + 26), lext = b.readUInt16LE(o + 28);
    const nom = b.subarray(o + 30, o + 30 + lnom).toString("utf8");
    const data = b.subarray(o + 30 + lnom + lext, o + 30 + lnom + lext + comp);
    out[nom] = inflateRawSync(data).toString("utf8");
    o += 30 + lnom + lext + comp;
  }
  return out;
}

describe("fichiers du rapport des ventes", () => {
  it("résume par profil (part du total)", () => {
    const r = resumeParProfil(d.ventes);
    assert.equal(r.total, 3500);
    assert.deepEqual(r.profils.map((p) => [p.nom, p.tickets, p.montant, p.part]), [["01-MOIS", 1, 2000, 57.1], ["05-JOURS", 3, 1500, 42.9]]);
  });
  it("csv inchangé", () => {
    assert.match(genererCsv(d), /TOTAL;4;;3500;/);
  });
  it("xlsx : archive valide, 2 feuilles, styles, montants numériques", () => {
    const f = fichierRapport("xlsx", d);
    assert.equal(f.nom, "rapport-ventes-2026-11-22.xlsx");
    const z = lireZip(f.contenu);
    for (const n of ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) assert.ok(z[n], n);
    assert.match(z["xl/workbook.xml"], /name="Résumé"/);
    assert.match(z["xl/worksheets/sheet1.xml"], /<v>3500<\/v>/);
    assert.match(z["xl/worksheets/sheet2.xml"], /5j443469/);
    assert.match(z["xl/styles.xml"], /FF1E3A8A/);
  });
  it("doc : vrai document Word (.docx) mis en forme", () => {
    const f = fichierRapport("doc", d);
    assert.equal(f.nom, "rapport-ventes-2026-11-22.docx");
    const doc = lireZip(f.contenu)["word/document.xml"];
    assert.match(doc, /w:fill="1E3A8A"/);
    assert.match(doc, /3 500 F/);
    assert.match(doc, /Détail ticket par ticket/);
  });
  it("xlsx : part en fraction (affichée 57,1 %)", () => {
    const z = lireZip(fichierRapport("xlsx", d).contenu);
    assert.match(z["xl/worksheets/sheet1.xml"], /<v>0\.571<\/v>/);
  });
});
