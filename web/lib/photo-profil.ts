// Controle du contenu reel de la photo (pur, testable). Le type declare par le
// navigateur n'est pas fiable, et le SVG reste refuse car il peut porter du script.
export const TAILLE_MAX_PHOTO = 2 * 1024 * 1024;

export function detecterTypeImage(o: Uint8Array): string | null {
  const texte = (debut: number, fin: number) =>
    String.fromCharCode(...o.subarray(debut, fin));
  if (o.length >= 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) {
    return "image/jpeg";
  }
  if (o.length >= 8 && o[0] === 0x89 && texte(1, 4) === "PNG" &&
    o[4] === 0x0d && o[5] === 0x0a && o[6] === 0x1a && o[7] === 0x0a) {
    return "image/png";
  }
  if (o.length >= 12 && texte(0, 4) === "RIFF" && texte(8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}
