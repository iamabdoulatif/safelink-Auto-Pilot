// Autorisation Telegram avant generation : validation pure (testable
// sans base ni routeur) + verification du profil sur RouterOS (lecture
// seule, identifiants du tenant). Le tenantId envoye par le client n'est
// JAMAIS lu : l'espace vient du bot associe au chatId, en base.
const QUANTITES = [120, 240, 480, 500];

export type DemandeAutorisation = {
  chatId: string;
  routeurId: number;
  profil: string;
  qty: number;
  simulation: boolean;
};

export function validerDemandeAutorisation(
  corps: unknown,
): DemandeAutorisation | { erreur: string; statut: number } {
  const b = (corps ?? {}) as Record<string, unknown>;
  const chatId = typeof b["chatId"] === "string" ? b["chatId"].trim() : "";
  const profil = typeof b["profile"] === "string" ? b["profile"].trim() : "";
  const routeurId = typeof b["routerId"] === "number" ? b["routerId"] : NaN;
  const qty = typeof b["qty"] === "number" ? b["qty"] : NaN;
  if (!chatId) return { erreur: "chatId obligatoire.", statut: 400 };
  if (!Number.isInteger(routeurId) || routeurId <= 0) {
    return { erreur: "Routeur obligatoire.", statut: 400 };
  }
  if (!profil || profil.length > 64) return { erreur: "Profil invalide.", statut: 400 };
  if (!Number.isInteger(qty) || !QUANTITES.includes(qty)) {
    return { erreur: "Quantité invalide.", statut: 400 };
  }
  return { chatId, routeurId, profil, qty, simulation: b["simulation"] === true };
}

// Le profil doit exister REELLEMENT sur RouterOS (pas seulement dans la
// liste fermee ci-dessus) : comparaison exacte, sensible a la casse.
export async function profilExisteSurRouteur(
  lireProfils: () => Promise<unknown>,
  profil: string,
): Promise<boolean> {
  let reponse: unknown;
  try {
    reponse = await lireProfils();
  } catch {
    return false;
  }
  if (!Array.isArray(reponse)) return false;
  return reponse.some(
    (p) => (p as { name?: unknown } | null)?.name === profil,
  );
}
