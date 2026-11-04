import { createHmac, timingSafeEqual } from "node:crypto";

// Signatures HMAC-SHA256 entre l'application et n8n, dans les deux sens.
// Le message signe est le JSON CANONIQUE de la charge (cles triees,
// sans espaces) : l'emetteur signe la chaine exacte qu'il envoie, le
// destinataire la revérifie a l'identique. Refus ferme si le secret
// manque ou si la signature est absente : un webhook sans secret est
// une porte ouverte.
export function canonicaliser(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return "null";
  if (Array.isArray(valeur)) {
    return "[" + valeur.map(canonicaliser).join(",") + "]";
  }
  if (typeof valeur === "object") {
    const entrees = Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return (
      "{" +
      entrees
        .map(([k, v]) => JSON.stringify(k) + ":" + canonicaliser(v))
        .join(",") +
      "}"
    );
  }
  const texte = JSON.stringify(valeur);
  if (typeof texte !== "string") throw new Error("Valeur non signable.");
  return texte;
}

export function signer(secret: string, charge: unknown): string {
  return createHmac("sha256", secret).update(canonicaliser(charge)).digest("hex");
}

// Compare la signature recue a celle attendue sur le corps BRUT recu.
// Les deux chaines hex sont comparees en temps constant.
export function verifierBrut(
  secret: string,
  brut: string,
  signatureHex: string,
): boolean {
  if (!secret || !/^[0-9a-f]{64}$/i.test(signatureHex.trim())) return false;
  const attendue = createHmac("sha256", secret).update(brut, "utf8").digest();
  const recue = Buffer.from(signatureHex.trim(), "hex");
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}
