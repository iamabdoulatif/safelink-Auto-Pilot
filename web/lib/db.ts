import { Pool } from "pg";

// Un seul pool pour toute l'application. En developpement, Next.js recharge les
// modules a chaque modification : sans ce cache global, on ouvrirait une
// nouvelle reserve de connexions a chaque sauvegarde de fichier, et Postgres
// finirait par refuser les connexions.
const global_ = globalThis as unknown as { pool?: Pool };

export const db =
  global_.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") global_.pool = db;
