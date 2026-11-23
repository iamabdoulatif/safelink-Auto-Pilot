import { deflateRawSync } from "node:zlib";

// Fichier joint au rapport des ventes, au format choisi par la zone :
// xlsx (Excel mis en forme), csv (données brutes) ou doc (Word .docx
// mis en forme). Logique pure, sans réseau ni base : testable seule.

export type FormatRapport = "xlsx" | "csv" | "doc";
export const FORMATS_RAPPORT: FormatRapport[] = ["xlsx", "csv", "doc"];

export type VenteRapport = {
  ticket: string;
  date: string;
  heure: string;
  profil: string;
  prix: number;
  vendeur: string;
};

export type DonneesRapport = {
  titre: string; // « Rapport journalier des ventes »
  zone: string; // nom de la zone / du routeur
  periode: string; // « le 2026-11-22 (00h à 00h) »
  debut: string; // AAAA-MM-JJ, pour le nom du fichier
  sousTitre?: string; // « Vos ventes » (vendeur)
  ventes: VenteRapport[];
  reste?: Record<string, number>; // stock restant par profil (gestion)
};

export type FichierRapport = { nom: string; mime: string; contenu: Buffer };

const fmt = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";

export function resumeParProfil(ventes: VenteRapport[]) {
  const r: Record<string, { tickets: number; montant: number; prixUnitaire: number }> = {};
  for (const v of ventes) {
    r[v.profil] ??= { tickets: 0, montant: 0, prixUnitaire: v.prix };
    r[v.profil].tickets += 1;
    r[v.profil].montant += v.prix;
  }
  const total = ventes.reduce((s, v) => s + v.prix, 0);
  return {
    total,
    profils: Object.keys(r)
      .sort((a, b) => r[b].montant - r[a].montant)
      .map((nom) => ({ nom, ...r[nom], part: total > 0 ? Math.round((r[nom].montant * 1000) / total) / 10 : 0 })),
  };
}

// ---------- CSV (identique au précédent envoi) ----------
export function genererCsv(d: DonneesRapport): string {
  const champ = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const ligne = (cols: unknown[]) => cols.map(champ).join(";");
  const lignes = [ligne(["ticket", "date de vente", "heure de vente", "profil", "prix unitaire (F)", "vendeur"])];
  for (const v of d.ventes) lignes.push(ligne([v.ticket, v.date, v.heure || "—", v.profil, v.prix, v.vendeur]));
  const { total, profils } = resumeParProfil(d.ventes);
  lignes.push("", ligne(["Résumé par profil"]));
  lignes.push(ligne(["profil", "tickets vendus", "prix unitaire (F)", "somme vendue (F)", "reste en stock"]));
  for (const p of [...profils].sort((a, b) => a.nom.localeCompare(b.nom)))
    lignes.push(ligne([p.nom, p.tickets, p.prixUnitaire, p.montant, d.reste ? (d.reste[p.nom] ?? 0) : ""]));
  lignes.push(ligne(["TOTAL", d.ventes.length, "", total, ""]));
  return "﻿" + lignes.join("\n") + "\n";
}

// ---------- Excel (.xlsx) mis en forme, sans dépendance ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Archive ZIP minimale (deflate) : ce qu'il faut pour un .xlsx.
export function zip(fichiers: { nom: string; texte: string }[]): Buffer {
  const locaux: Buffer[] = [];
  const centraux: Buffer[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const brut = Buffer.from(f.texte, "utf8");
    const comp = deflateRawSync(brut);
    const crc = crc32(brut);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28); central.writeUInt32LE(decalage, 42);
    locaux.push(local, nom, comp);
    centraux.push(central, nom);
    decalage += local.length + nom.length + comp.length;
  }
  const dir = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, dir, fin]);
}

const x = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function colonne(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
// Styles (index s=) : 0 normal, 1 titre, 2 sous-titre, 3 en-tête tableau,
// 4 texte, 5 montant, 6 texte zébré, 7 montant zébré, 8 total texte,
// 9 total montant (vert), 10 entier, 11 entier zébré, 12 libellé carte,
// 13 valeur carte (montant), 14 pourcentage, 15 pourcentage zébré,
// 16 valeur carte (entier).
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0&quot; F&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
<fonts count="7"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FFDBEAFE"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF16A34A"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill></fills>
<borders count="3"><border/><border><bottom style="thin"><color rgb="FFE2E8F0"/></bottom></border><border><top style="medium"><color rgb="FF1E3A8A"/></top></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="17">
<xf/>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
<xf fontId="2" fillId="2" applyFont="1" applyFill="1"/>
<xf fontId="3" fillId="2" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
<xf borderId="1" applyBorder="1"/>
<xf numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf fillId="3" borderId="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf fontId="4" borderId="2" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="5" borderId="2" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="1" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="1" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf fontId="6" fillId="4" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="4" fillId="4" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="165" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="1" fontId="4" fillId="4" applyNumberFormat="1" applyFont="1" applyFill="1"/>
</cellXfs></styleSheet>`;

type Cellule = string | number | null | { v: string | number; s: number };
function feuille(lignes: Cellule[][], largeurs: number[], fusions: string[] = [], hauteurs: Record<number, number> = {}): string {
  const rows = lignes
    .map((cells, r) => {
      const ht = hauteurs[r] ? ` ht="${hauteurs[r]}" customHeight="1"` : "";
      const cs = cells
        .map((c, i) => {
          if (c === null || c === "") return "";
          const ref = colonne(i) + (r + 1);
          const val = typeof c === "object" ? c.v : c;
          const s = typeof c === "object" ? ` s="${c.s}"` : "";
          return typeof val === "number"
            ? `<c r="${ref}"${s}><v>${val}</v></c>`
            : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${x(val)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}"${ht}>${cs}</row>`;
    })
    .join("");
  const cols = largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const merges = fusions.length ? `<mergeCells count="${fusions.length}">${fusions.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData>${merges}</worksheet>`;
}

export function genererXlsx(d: DonneesRapport): Buffer {
  const { total, profils } = resumeParProfil(d.ventes);
  const n = (v: number, s: number) => ({ v, s });
  const t = (v: string, s: number) => ({ v, s });
  const avecReste = !!d.reste;
  const nbCol = avecReste ? 5 : 4;
  const bandeau = (v: string, s: number) => [t(v, s), ...Array.from({ length: nbCol - 1 }, () => t("", s))];
  const resume: Cellule[][] = [
    bandeau(d.titre, 1),
    bandeau(d.zone + " · Période " + d.periode + (d.sousTitre ? " · " + d.sousTitre : ""), 2),
    [],
    [t("TICKETS VENDUS", 12), t("TOTAL VENDU", 12), t("PROFILS VENDUS", 12)],
    [n(d.ventes.length, 16), n(total, 13), n(profils.length, 16)],
    [],
    [t("Profil", 3), t("Tickets", 3), t("Montant", 3), t("Part", 3), ...(avecReste ? [t("Reste en stock", 3)] : [])],
    ...profils.map((p, i) => [
      t(p.nom, i % 2 ? 6 : 4), n(p.tickets, i % 2 ? 11 : 10), n(p.montant, i % 2 ? 7 : 5), n(Math.round(p.part * 10) / 1000, i % 2 ? 15 : 14),
      ...(avecReste ? [n(d.reste?.[p.nom] ?? 0, i % 2 ? 11 : 10)] : []),
    ]),
    [t("Total", 8), n(d.ventes.length, 8), n(total, 9), t("100 %", 8), ...(avecReste ? [t("", 8)] : [])],
  ];
  const avecVendeur = d.ventes.some((v) => v.vendeur);
  const tickets: Cellule[][] = [
    [t("Ticket", 3), t("Date", 3), t("Heure", 3), t("Profil", 3), t("Prix", 3), ...(avecVendeur ? [t("Vendeur", 3)] : [])],
    ...d.ventes.map((v, i) => [
      t(v.ticket, i % 2 ? 6 : 4), t(v.date, i % 2 ? 6 : 4), t(v.heure || "—", i % 2 ? 6 : 4), t(v.profil, i % 2 ? 6 : 4),
      n(v.prix, i % 2 ? 7 : 5), ...(avecVendeur ? [t(v.vendeur, i % 2 ? 6 : 4)] : []),
    ]),
    [t("Total", 8), t("", 8), t("", 8), t(d.ventes.length + " tickets", 8), n(total, 9), ...(avecVendeur ? [t("", 8)] : [])],
  ];
  const der = colonne(nbCol - 1);
  const fichiers = [
    { nom: "[Content_Types].xml", texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nom: "_rels/.rels", texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nom: "xl/workbook.xml", texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Résumé" sheetId="1" r:id="rId1"/><sheet name="Tickets" sheetId="2" r:id="rId2"/></sheets></workbook>` },
    { nom: "xl/_rels/workbook.xml.rels", texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nom: "xl/styles.xml", texte: STYLES },
    { nom: "xl/worksheets/sheet1.xml", texte: feuille(resume, [22, 16, 18, 12, 16].slice(0, nbCol), [`A1:${der}1`, `A2:${der}2`], { 0: 30, 1: 20, 4: 24 }) },
    { nom: "xl/worksheets/sheet2.xml", texte: feuille(tickets, [16, 13, 9, 16, 12, 16].slice(0, avecVendeur ? 6 : 5)) },
  ];
  return zip(fichiers);
}

// ---------- Word (.docx) mis en forme ----------
// Vrai document Word (OOXML) : s'ouvre dans Word, Pages, Google Docs et
// l'aperçu du téléphone, contrairement à un .doc HTML.
const BLEU = "1E3A8A", ZEBRE = "F1F5F9", CARTE = "EFF6FF", VERT = "16A34A", GRIS = "64748B";
function run(t: string, o: { b?: boolean; c?: string; sz?: number } = {}) {
  const rpr = `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>${o.b ? "<w:b/>" : ""}${o.c ? `<w:color w:val="${o.c}"/>` : ""}<w:sz w:val="${o.sz ?? 20}"/></w:rPr>`;
  return `<w:r>${rpr}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
}
function para(runs: string, o: { droite?: boolean; avant?: number; apres?: number } = {}) {
  return `<w:p><w:pPr><w:spacing w:before="${o.avant ?? 0}" w:after="${o.apres ?? 0}"/>${o.droite ? '<w:jc w:val="right"/>' : ""}</w:pPr>${runs}</w:p>`;
}
function cellule(contenu: string, largeur: number, fond?: string) {
  return `<w:tc><w:tcPr><w:tcW w:w="${largeur}" w:type="dxa"/>${fond ? `<w:shd w:val="clear" w:color="auto" w:fill="${fond}"/>` : ""}<w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${contenu}</w:tc>`;
}
function tableau(lignes: string[], largeurs: number[]) {
  const grille = largeurs.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const bord = `<w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/><w:bottom w:val="single" w:sz="4" w:color="E2E8F0"/></w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${largeurs.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${bord}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grille}</w:tblGrid>${lignes.join("")}</w:tbl>`;
}

export function genererDocx(d: DonneesRapport): Buffer {
  const { total, profils } = resumeParProfil(d.ventes);
  const avecVendeur = d.ventes.some((v) => v.vendeur);
  const L = 9600; // largeur utile (twips)
  const corps: string[] = [];
  corps.push(tableau([`<w:tr>${cellule(para(run(d.titre, { b: true, c: "FFFFFF", sz: 36 }), { apres: 60 }) + para(run(d.zone + " · Période " + d.periode + (d.sousTitre ? " · " + d.sousTitre : ""), { c: "DBEAFE", sz: 22 })), L, BLEU)}</w:tr>`], [L]));
  corps.push(para("", { apres: 160 }));
  const carte = (lib: string, val: string, coul?: string) => cellule(para(run(lib, { c: GRIS, sz: 16 })) + para(run(val, { b: true, sz: 34, c: coul })), L / 3, CARTE);
  corps.push(tableau([`<w:tr>${carte("TICKETS VENDUS", String(d.ventes.length))}${carte("TOTAL VENDU", fmt(total), VERT)}${carte("PROFILS VENDUS", String(profils.length))}</w:tr>`], [L / 3, L / 3, L / 3]));
  const titreSection = (t: string) => para(run(t, { b: true, c: BLEU, sz: 26 }), { avant: 280, apres: 100 });
  const entete = (cols: [string, number, boolean?][]) => `<w:tr>${cols.map(([t, w, dr]) => cellule(para(run(t, { b: true, c: "FFFFFF", sz: 19 }), { droite: dr }), w, BLEU)).join("")}</w:tr>`;
  const ligne = (cols: [string, number, boolean?][], i: number, o: { b?: boolean; c?: string } = {}) =>
    `<w:tr>${cols.map(([t, w, dr]) => cellule(para(run(t, { sz: 19, b: o.b, c: o.c }), { droite: dr }), w, i % 2 ? ZEBRE : undefined)).join("")}</w:tr>`;
  corps.push(titreSection("Ventes par profil"));
  if (profils.length) {
    const lp = d.reste ? [2600, 1500, 2000, 1500, 2000] : [3200, 1800, 2600, 2000];
    const cols = (a: string[]) => a.map((t, i) => [t, lp[i], i > 0] as [string, number, boolean]);
    corps.push(tableau([
      entete(cols(["Profil", "Tickets", "Montant", "Part", ...(d.reste ? ["Reste en stock"] : [])])),
      ...profils.map((p, i) => ligne(cols([p.nom, String(p.tickets), fmt(p.montant), String(p.part).replace(".", ",") + " %", ...(d.reste ? [String(d.reste[p.nom] ?? 0)] : [])]), i)),
      ligne(cols(["Total", String(d.ventes.length), fmt(total), "100 %", ...(d.reste ? [""] : [])]), 0, { b: true }),
    ], lp));
  } else corps.push(para(run("Aucune vente sur la période.")));
  if (d.ventes.length) {
    corps.push(titreSection("Détail ticket par ticket"));
    const lt = avecVendeur ? [1700, 1500, 1000, 1800, 1500, 2100] : [2100, 1900, 1300, 2300, 2000];
    const cols = (a: string[]) => a.map((t, i) => [t, lt[i], i === 4] as [string, number, boolean]);
    corps.push(tableau([
      entete(cols(["Ticket", "Date", "Heure", "Profil", "Prix", ...(avecVendeur ? ["Vendeur"] : [])])),
      ...d.ventes.map((v, i) => ligne(cols([v.ticket, v.date, v.heure || "—", v.profil, fmt(v.prix), ...(avecVendeur ? [v.vendeur] : [])]), i)),
    ], lt));
  }
  corps.push(para(run("SafeLink Auto-Pilot · ventes enregistrées par MikHmon", { c: "94A3B8", sz: 16 }), { avant: 300 }));
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corps.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1150" w:bottom="1000" w:left="1150" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    { nom: "[Content_Types].xml", texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { nom: "_rels/.rels", texte: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { nom: "word/document.xml", texte: document },
  ]);
}

export function fichierRapport(format: FormatRapport, d: DonneesRapport): FichierRapport {
  const base = "rapport-ventes-" + d.debut;
  if (format === "xlsx")
    return { nom: base + ".xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contenu: genererXlsx(d) };
  if (format === "doc")
    return { nom: base + ".docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contenu: genererDocx(d) };
  return { nom: base + ".csv", mime: "text/csv", contenu: Buffer.from(genererCsv(d), "utf8") };
}
