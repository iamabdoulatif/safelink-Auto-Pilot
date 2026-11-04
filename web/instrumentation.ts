// Crochet de demarrage Next.js : applique les migrations SQL manquantes
// avant de servir les pages. En production, un echec de migration bloque
// le demarrage (mieux vaut un deploy qui refuse que des ecritures sur un
// schema obsolete). En developpement, erreur lisible et demarrage continue.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { appliquerMigrations } = await import("./lib/migrations");
    const { appliquees, ignorees, erreur } = await appliquerMigrations();
    for (const nom of appliquees) {
      console.log(`[migrations] appliquee : ${nom}`);
    }
    if (erreur) {
      console.error(`[migrations] ECHEC (${ignorees.length} deja appliquees) : ${erreur}`);
      if (process.env.NODE_ENV === "production") {
        throw new Error(`[migrations] demarrage refuse : ${erreur}`);
      }
    }
  } catch (e) {
    console.error("[migrations] demarrage impossible :", e);
    if (process.env.NODE_ENV === "production") throw e;
  }
}
