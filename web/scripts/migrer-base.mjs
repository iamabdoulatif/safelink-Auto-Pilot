// Applique les migrations SQL manquantes, a la main :
//   npm run db:migrer
// Lit DATABASE_URL dans web/.env.local, rejoue db/migrations/*.sql dans
// l'ordre, memorise chaque fichier dans migrations_appliquees. Surrogate
// de secours si le crochet de demarrage n'a pas pu ecrire (droits, base
// arretee pendant le boot).
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url)); // web/scripts
const racineWeb = join(ici, "..");
const dossier = join(racineWeb, "..", "db", "migrations");

function lireEnv() {
  return readFile(join(racineWeb, ".env.local"), "utf-8").catch(() => "");
}

const brut = await lireEnv();
const ligne = brut.split("\n").find((l) => l.startsWith("DATABASE_URL=")) ?? "";
const chaineFichier = ligne
  .slice("DATABASE_URL=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
const chaine = (process.env.DATABASE_URL ?? "").trim() || chaineFichier;
if (!chaine) {
  console.error("DATABASE_URL absente de l'environnement et de web/.env.local.");
  process.exit(1);
}
const { default: pg } = await import("pg").catch(() => {
  console.error("Paquet pg introuvable : lancez npm install dans web/.");
  process.exit(1);
});
const fichiers = [
  { nom: "schema.sql", chemin: join(racineWeb, "..", "db", "schema.sql") },
  ...(await readdir(dossier))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ nom: f, chemin: join(dossier, f) })),
];
const pool = new pg.Pool({ connectionString: chaine, max: 1 });
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('safelink-migrations'))");
  await client.query(
    `CREATE TABLE IF NOT EXISTS migrations_appliquees (
       nom text PRIMARY KEY,
       applique_le timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await client.query("SELECT nom FROM migrations_appliquees");
  const connues = new Set(rows.map((r) => r.nom));
  for (const fichier of fichiers) {
    if (connues.has(fichier.nom)) {
      console.log(`ignoree (deja appliquee) : ${fichier.nom}`);
      continue;
    }
    const sql = await readFile(fichier.chemin, "utf-8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO migrations_appliquees (nom) VALUES ($1) ON CONFLICT (nom) DO NOTHING",
        [fichier.nom],
      );
      await client.query("COMMIT");
      console.log(`appliquee : ${fichier.nom}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(`ECHEC ${fichier.nom} :`, e instanceof Error ? e.message : e);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock_all()").catch(() => undefined);
  client.release();
  await pool.end();
}
