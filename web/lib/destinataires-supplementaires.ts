// Autres destinataires du PDF d'une regle (fonction pure, testable).
// Telegram exige un chat ID : l'API ne permet pas d'ecrire a un numero.
export const MAX_DESTINATAIRES = 5;

export type DestinataireSupplementaire = {
  canal: "telegram" | "whatsapp";
  valeur: string;
};

export function validerDestinataires(
  brut: unknown,
): { liste: DestinataireSupplementaire[] } | { erreur: string } {
  if (brut === undefined || brut === null) return { liste: [] };
  if (!Array.isArray(brut)) return { erreur: "Liste de destinataires invalide." };
  if (brut.length > MAX_DESTINATAIRES) {
    return { erreur: `${MAX_DESTINATAIRES} autres destinataires au maximum.` };
  }
  const liste: DestinataireSupplementaire[] = [];
  for (const element of brut) {
    const e = (element ?? {}) as Record<string, unknown>;
    const valeur = typeof e["valeur"] === "string" ? e["valeur"].trim() : "";
    if (e["canal"] === "telegram") {
      if (!/^-?\d{1,20}$/.test(valeur)) {
        return { erreur: `Chat ID Telegram invalide : ${valeur || "vide"}.` };
      }
      if (!liste.some((d) => d.canal === "telegram" && d.valeur === valeur)) {
        liste.push({ canal: "telegram", valeur });
      }
    } else if (e["canal"] === "whatsapp") {
      const numero = valeur.replace(/[\s.-]/g, "");
      if (!/^\+?[1-9]\d{7,14}$/.test(numero)) {
        return {
          erreur: `Numéro WhatsApp invalide : ${valeur || "vide"} (format international).`,
        };
      }
      if (!liste.some((d) => d.canal === "whatsapp" && d.valeur === numero)) {
        liste.push({ canal: "whatsapp", valeur: numero });
      }
    } else {
      return { erreur: "Canal de destinataire inconnu." };
    }
  }
  return { liste };
}
