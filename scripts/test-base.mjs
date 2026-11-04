// Controle de la base versionnee : `npm test` a la racine.
// Phase statique (toujours) : ordre, idempotence, non-destruction.
// Phase live (si SAFELINK_TEST_DATABASE_URL est defini) : applique
// schema.sql + migrations sur CETTE base de test, rejoue, audite tables
// et colonnes utilisees par web/. Ne pointe JAMAIS cette variable vers
// la production : le script affiche l'hote cible avant d'ecrire.
// Usage : npm test
//   SAFELINK_TEST_DATABASE_URL=postgresql://... npm test   (phase live)
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_MIG = join(RACINE, "db", "migrations");
const SCHEMA = join(RACINE, "db", "schema.sql");
const DOSSIER_WEB = join(RACINE, "web");

let echecs = 0;
function echec(message) {
  echecs++;
  console.error("ECHEC : " + message);
}
function ok(message) {
  console.log("OK    : " + message);
}

// ---------- phase statique ----------
const fichiers = (await readdir(DOSSIER_MIG)).filter((f) => f.endsWith(".sql")).sort();
const numeros = fichiers.map((f) => Number((f.match(/^(\d+)/) || [])[1]));
if (numeros.some((n) => !Number.isInteger(n))) {
  echec("des migrations n'ont pas de prefixe numerique.");
} else {
  const tries = [...numeros].sort((a, b) => a - b);
  if (JSON.stringify(numeros) !== JSON.stringify(tries)) echec("migrations hors ordre.");
  else ok(`ordre migrations (${fichiers.length} fichiers, ${tries[0]}..${tries[tries.length - 1]}).`);
}
for (const f of fichiers) {
  const sql = await readFile(join(DOSSIER_MIG, f), "utf-8");
  if (/(^|\s)(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i.test(sql)) {
    echec(`${f} : instruction destructive (DROP/TRUNCATE/DELETE FROM).`);
  }
  for (const m of sql.matchAll(/^CREATE\s+(TABLE|INDEX)\s+(.+)$/gim)) {
    if (!/IF NOT EXISTS/i.test(m[2])) echec(`${f} : ${m[1]} sans IF NOT EXISTS.`);
  }
  for (const m of sql.matchAll(/ADD\s+COLUMN\s+(.+)$/gim)) {
    if (!/IF NOT EXISTS/i.test(m[1])) echec(`${f} : ADD COLUMN sans IF NOT EXISTS.`);
  }
}
ok("aucune migration destructive.");
const schema = await readFile(SCHEMA, "utf-8");
if (/^CREATE\s+(TABLE|INDEX)\s+(?!IF NOT EXISTS)/gim.test(schema)) {
  echec("db/schema.sql : CREATE sans IF NOT EXISTS.");
} else {
  ok("db/schema.sql rejouable (IF NOT EXISTS partout).");
}

// ---------- phase live (optionnelle) ----------
const cible = process.env.SAFELINK_TEST_DATABASE_URL ?? "";
if (!cible) {
  console.log("SAUTE  : phase live (definir SAFELINK_TEST_DATABASE_URL pour l'activer).");
} else {
  let hote = "?";
  try {
    const u = new URL(cible);
    hote = u.hostname + (u.port ? ":" + u.port : "") + u.pathname;
  } catch { /* url invalide : echec plus bas */ }
  console.log(`CIBLE : base de test ${hote} (jamais la production).`);
  const pg = await import(join(DOSSIER_WEB, "node_modules", "pg", "lib", "index.js")).catch(
    () => import("pg").catch(() => null),
  );
  const Pilote = pg?.default?.Pool ?? pg?.Pool;
  if (!Pilote) {
    echec("pilote pg introuvable (npm install dans web/).");
  } else {
    const pool = new Pilote({ connectionString: cible, max: 1 });
    let client = null;
    try {
      client = await pool.connect();
    } catch {
      echec(`base de test injoignable (${hote}).`);
    }
    if (client) try {
      await client.query("SELECT pg_advisory_lock(hashtext('safelink-migrations'))");
      try {
        await client.query(
          `CREATE TABLE IF NOT EXISTS migrations_appliquees (
             nom text PRIMARY KEY, applique_le timestamptz NOT NULL DEFAULT now())`,
        );
        const { rows } = await client.query("SELECT nom FROM migrations_appliquees");
        const connues = new Set(rows.map((r) => r.nom));
        const attendus = ["schema.sql", ...fichiers];
        for (const nom of attendus) {
          if (connues.has(nom)) {
            console.log(`IGNORE: ${nom}`);
            continue;
          }
          const sql = nom === "schema.sql"
            ? schema
            : await readFile(join(DOSSIER_MIG, nom), "utf-8");
          await client.query("BEGIN");
          try {
            await client.query(sql);
            await client.query(
              "INSERT INTO migrations_appliquees (nom) VALUES ($1) ON CONFLICT (nom) DO NOTHING",
              [nom],
            );
            await client.query("COMMIT");
            console.log(`OK    : ${nom}`);
          } catch (e) {
            await client.query("ROLLBACK").catch(() => undefined);
            echec(`${nom} : ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
            break;
          }
        }
      } finally {
        await client.query("SELECT pg_advisory_unlock_all()").catch(() => undefined);
      }
      ok("verrou consultatif pose et rendu.");
      // Tables exigues par le metier.
      const { rows: tables } = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const presentes = new Set(tables.map((r) => r.table_name));
      for (const t of [
        "configurations_routeurs", "configurations_telegram", "ticket_generation_runs",
        "auto_replenishment_settings", "internal_nonces", "configurations_whatsapp",
        "configurations_printnode", "hotspot_profiles", "lots_tickets", "executions_n8n",
      ]) {
        if (!presentes.has(t)) echec(`table absente : ${t}.`);
      }
      ok("10 tables metier presentes.");
      // Colonnes citees par le code.
      const { rows: cols } = await client.query(
        `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
      );
      const parTable = {};
      for (const c of cols) (parTable[c.table_name] ??= new Set()).add(c.column_name);
      const MOTS_VIDES = new Set(
        ("select,from,where,join,left,right,inner,on,as,and,or,not,null,true,false,distinct,order,by,group,limit,insert,into,values,update,set,delete,returning,conflict,nothing,create,now,desc,count,coalesce,case,when,then,else,end,interval,like,in,is,between,lateral,query,map,has,env").split(","),
      );
      async function fichiersTs(dir, acc = []) {
        const { readdir: lire } = await import("node:fs/promises");
        for (const e of await lire(dir, { withFileTypes: true })) {
          if (e.name === "node_modules" || e.name === ".next") continue;
          const p = join(dir, e.name);
          if (e.isDirectory()) await fichiersTs(p, acc);
          else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) acc.push(p);
        }
        return acc;
      }
      let auditees = 0;
      for (const dir of [join(DOSSIER_WEB, "app"), join(DOSSIER_WEB, "lib")]) {
        for (const f of await fichiersTs(dir)) {
          const src = await readFile(f, "utf-8");
          for (const m of src.matchAll(/`([^`]*)`/g)) {
            const sql = m[1];
            if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql)) continue;
            if (sql.includes("${")) continue;
            const tables = new Set();
            for (const t of sql.matchAll(/\b(?:FROM|JOIN(?! LATERAL)|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_][a-z0-9_]*)/gi)) {
              if (t[0].toUpperCase().startsWith("UPDATE") && sql.slice(Math.max(0, t.index - 3), t.index).toUpperCase() === "DO ") continue;
              tables.add(t[1].toLowerCase());
            }
            const union = new Set();
            for (const t of tables) for (const c of parTable[t] ?? []) union.add(c);
            const candidats = new Set();
            for (const c of sql.matchAll(/\b[a-z_][a-z0-9_]*\.([a-z_][a-z0-9_]*)/g)) {
              candidats.add(c[1].toLowerCase());
            }
            for (const cand of candidats) {
              if (MOTS_VIDES.has(cand) || /^\d+$/.test(cand)) continue;
              if (!union.has(cand)) {
                echec(`colonne douteuse (${f.replace(RACINE + "/", "")}, tables={${[...tables].join(",")}}): ${cand}.`);
              }
            }
            auditees++;
          }
        }
      }
      ok(`${auditees} requetes auditees.`);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

if (echecs > 0) {
  console.error(`${echecs} echec(s).`);
  process.exit(1);
}
console.log("OK : base versionnee coherente.");
