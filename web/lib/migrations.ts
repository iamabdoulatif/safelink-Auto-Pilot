import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";

// Source de verite : le SQL manuel versionne (db/schema.sql puis
// db/migrations/*.sql via pg). Prisma est une configuration heritee,
// inutilisee par l'application (voir prisma/schema.prisma).
//
// Garanties :
// - ordre : schema.sql d'abord, puis les migrations par nom ;
// - rejouable : fichiers idempotents + nom memorise dans
//   migrations_appliquees ;
// - concurrence : verrou consultatif PostgreSQL (un seul appliquant) ;
// - echec : renvoye a l'appelant. En production, instrumentation.ts
//   bloque le demarrage ; en dev, erreur lisible sans demarrage coupe.
const CLE_VERROU = "safelink-migrations";

export async function appliquerMigrations(): Promise<{
  appliquees: string[];
  ignorees: string[];
  erreur: string | null;
}> {
  const resultat = { appliquees: [] as string[], ignorees: [] as string[], erreur: null as string | null };
  if (!process.env.DATABASE_URL) {
    resultat.erreur = "DATABASE_URL absente : migrations ignorees.";
    return resultat;
  }
  // En dev : web/../db. Si le dossier est absent (paquet deploiement
  // sans les sources SQL), on ne fait rien ici (prod bloquera plus bas).
  const dossierDb = join(process.cwd(), "..", "db");
  let fichiers: { nom: string; chemin: string }[];
  try {
    const migrations = (await readdir(join(dossierDb, "migrations")))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => ({ nom: f, chemin: join(dossierDb, "migrations", f) }));
    fichiers = [
      { nom: "schema.sql", chemin: join(dossierDb, "schema.sql") },
      ...migrations,
    ];
  } catch {
    resultat.erreur = "Dossier db/ introuvable : rien applique.";
    return resultat;
  }
  const client = await db.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [CLE_VERROU]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS migrations_appliquees (
           nom text PRIMARY KEY,
           applique_le timestamptz NOT NULL DEFAULT now()
         )`,
      );
      const { rows } = await client.query<{ nom: string }>(
        "SELECT nom FROM migrations_appliquees",
      );
      const connues = new Set(rows.map((r) => r.nom));
      for (const fichier of fichiers) {
        if (connues.has(fichier.nom)) {
          resultat.ignorees.push(fichier.nom);
          continue;
        }
        const sql = await readFile(fichier.chemin, "utf-8");
        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query(
            "INSERT INTO migrations_appliquees (nom) VALUES ($1) " +
              "ON CONFLICT (nom) DO NOTHING",
            [fichier.nom],
          );
          await client.query("COMMIT");
          resultat.appliquees.push(fichier.nom);
        } catch (e) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Restauration impossible : on signale et on s'arrete.
          }
          resultat.erreur =
            `Migration ${fichier.nom} en echec : ` +
            (e instanceof Error ? e.message : String(e));
          return resultat;
        }
      }
      return resultat;
    } finally {
      await client.query("SELECT pg_advisory_unlock_all()").catch(() => undefined);
    }
  } catch (e) {
    resultat.erreur = e instanceof Error ? e.message : String(e);
    return resultat;
  } finally {
    client.release();
  }
}
