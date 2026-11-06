// Correspondance entre un modèle lu sur RouterOS et le catalogue
// officiel MikroTik. RouterOS renvoie par exemple « hAP ax³
// (C53UiG+5HPaxD2HPaxD) » : le code entre parenthèses est la clé la
// plus fiable, le nom normalisé sert de repli. Fonctions pures,
// testables sans base.

// Minuscules, exposants aplatis (³ -> 3), accents retirés, toute
// ponctuation devient une espace.
export function normaliserModele(brut: string | null | undefined): string {
  if (!brut) return "";
  return brut
    .replaceAll("³", "3")
    .replaceAll("²", "2")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Le code produit entre parenthèses, ex. « C53UiG+5HPaxD2HPaxD ».
export function extraireCodeModele(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const m = brut.match(/\(([^()]+)\)\s*$/);
  const code = m?.[1]?.trim();
  return code ? code : null;
}

// Toutes les clés sous lesquelles chercher ce modèle dans le
// catalogue : code (minuscules), nom normalisé, forme slug.
export function clesModele(brut: string | null | undefined): string[] {
  if (!brut?.trim()) return [];
  const cles = new Set<string>();
  const code = extraireCodeModele(brut);
  if (code) cles.add(code.toLowerCase());
  const sansCode = brut.replace(/\s*\([^()]*\)\s*$/, "");
  const nom = normaliserModele(sansCode);
  if (nom) {
    cles.add(nom);
    cles.add(nom.replaceAll(" ", "_"));
  }
  return [...cles];
}
