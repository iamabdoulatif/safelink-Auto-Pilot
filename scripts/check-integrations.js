// Diagnostic des intégrations RouterOS + n8n.
// Affiche DÉGRADÉ (sortie 1) au lieu d'un succès silencieux quand une
// dépendance est injoignable ou qu'un identifiant est manquant.
const { loadEnv, createRouterClient } = require("../lib/routeros");
const { n8nConfig, createN8nClient } = require("../lib/n8n");

async function main() {
  loadEnv();
  const lignes = [];
  let degrade = false;

  // --- RouterOS (utilisateur lecture seule) ---
  if (!process.env.ROUTEROS_URL || !process.env.ROUTEROS_USER) {
    lignes.push("routeros : CONFIG MANQUANTE (renseigner ROUTEROS_URL / ROUTEROS_USER)");
    degrade = true;
  } else if (!process.env.ROUTEROS_PASS) {
    lignes.push("routeros : CONFIG MANQUANTE (ROUTEROS_PASS est vide)");
    degrade = true;
  } else {
    const router = createRouterClient({
      baseUrl: process.env.ROUTEROS_URL,
      user: process.env.ROUTEROS_USER,
      pass: process.env.ROUTEROS_PASS,
      timeoutMs: 5000,
    });
    try {
      const enLigne = await router.ping();
      if (!enLigne) throw new Error("La racine WebFig n'a pas renvoyé 200");
      const info = await router.resource();
      const version = Array.isArray(info) ? info[0]?.version : info?.version;
      lignes.push(`routeros : EN LIGNE${version ? ` (RouterOS ${version})` : ""}`);
    } catch (err) {
      lignes.push(`routeros : HORS LIGNE (${err.cause?.code ?? err.message})`);
      degrade = true;
    }
  }
  if (!process.env.ROUTEROS_FIX_PASS) {
    lignes.push("routeros-fix : CONFIG MANQUANTE (ROUTEROS_FIX_PASS est vide — corrections désactivées)");
    degrade = true;
  } else {
    lignes.push("routeros-fix : CONFIGURÉ (utilisateur d'écriture présent)");
  }

  // --- n8n ---
  const n8n = n8nConfig();
  if (!n8n.baseUrl) {
    lignes.push("n8n : CONFIG MANQUANTE (renseigner N8N_BASE_URL)");
    degrade = true;
  } else {
    const client = createN8nClient({ baseUrl: n8n.baseUrl, timeoutMs: 5000 });
    try {
      const ok = await client.ping();
      lignes.push(ok ? `n8n : EN LIGNE (${n8n.baseUrl})` : `n8n : HORS LIGNE (${n8n.baseUrl} injoignable)`);
      if (!ok) degrade = true;
    } catch (err) {
      lignes.push(`n8n : HORS LIGNE (${err.cause?.code ?? err.message})`);
      degrade = true;
    }
  }
  if (!n8n.webhookSecret || !n8n.callbackSecret) {
    lignes.push("n8n-auth : CONFIG MANQUANTE (N8N_WEBHOOK_SECRET / N8N_CALLBACK_SECRET vides)");
    degrade = true;
  } else {
    lignes.push("n8n-auth : CONFIGURÉ");
  }

  for (const ligne of lignes) console.log(ligne);
  console.log(degrade ? "statut : DÉGRADÉ" : "statut : OK");
  process.exit(degrade ? 1 : 0);
}

main();
