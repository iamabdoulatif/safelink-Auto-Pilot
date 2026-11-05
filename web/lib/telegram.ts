// Verification d'un bot Telegram personnalise via getMe, avant sauvegarde.
// Le jeton ne transite que cote serveur et n'apparait dans aucun journal :
// en cas d'echec, seul le debut du diagnostic est conserve, jamais le jeton.
export type BotVerifie = { nom: string; identifiantNumerique: number };

export async function verifierJetonBot(jeton: string): Promise<BotVerifie> {
  if (!/^\d+:[\w-]{20,}$/.test(jeton.trim())) {
    throw new Error("Format de jeton invalide.");
  }
  let reponse: Response;
  try {
    reponse = await fetch(
      "https://api.telegram.org/bot" + jeton.trim() + "/getMe",
      { method: "GET", signal: AbortSignal.timeout(15000) },
    );
  } catch {
    throw new Error("Telegram injoignable : vérifiez la connexion sortante.");
  }
  let corps: { ok?: unknown; result?: unknown; description?: unknown } = {};
  try {
    corps = (await reponse.json()) as typeof corps;
  } catch {
    throw new Error("Réponse Telegram illisible.");
  }
  if (corps.ok !== true || typeof corps.result !== "object" || !corps.result) {
    throw new Error(
      "Jeton refusé par Telegram" +
        (typeof corps.description === "string" ? " : " + corps.description : "."),
    );
  }
  const resultat = corps.result as Record<string, unknown>;
  if (
    typeof resultat.username !== "string" ||
    typeof resultat.id !== "number"
  ) {
    throw new Error("Réponse getMe incomplète.");
  }
  return { nom: "@" + resultat.username, identifiantNumerique: resultat.id };
}

// Verifie qu'un Chat ID est visible par le bot (getChat), COTE SERVEUR.
// Le jeton et le chat ID ne sont jamais journalises : seul le resultat
// (titre trouve ou motif d'echec) est renvoye.
export async function verifierChatId(
  jeton: string,
  chatId: string,
): Promise<{ titre: string }> {
  if (!/^-?\d{1,20}$/.test(chatId.trim())) {
    throw new Error("Chat ID invalide (chiffres uniquement).");
  }
  let reponse: Response;
  try {
    reponse = await fetch(
      "https://api.telegram.org/bot" + jeton.trim() + "/getChat?chat_id=" +
        encodeURIComponent(chatId.trim()),
      { method: "GET", signal: AbortSignal.timeout(15000) },
    );
  } catch {
    throw new Error("Telegram injoignable : vérifiez la connexion sortante.");
  }
  let corps: { ok?: unknown; result?: unknown; description?: unknown } = {};
  try {
    corps = (await reponse.json()) as typeof corps;
  } catch {
    throw new Error("Réponse Telegram illisible.");
  }
  if (corps.ok !== true || typeof corps.result !== "object" || !corps.result) {
    throw new Error(
      "Chat ID inconnu de ce bot (ouvrez une discussion avec le bot puis réessayez)" +
        (typeof corps.description === "string" ? " : " + corps.description : "."),
    );
  }
  const resultat = corps.result as Record<string, unknown>;
  const titre = [resultat.title, resultat.username, resultat.first_name]
    .find((v): v is string => typeof v === "string" && v.length > 0);
  return { titre: titre ?? chatId.trim() };
}

// Envoie un message texte. L'erreur ne contient ni le jeton du bot ni le
// contenu du message : elle peut etre journalisee sans risque.
export async function envoyerMessageTelegram(
  jeton: string,
  chatId: string,
  texte: string,
): Promise<void> {
  const reponse = await fetch(
    `https://api.telegram.org/bot${jeton}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: texte,
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!reponse.ok) {
    throw new Error("Telegram a refusé le message (HTTP " + reponse.status + ").");
  }
}
