// Fichier herite, inutilise : les migrations officielles sont appliquees
// par web/lib/migrations.ts (demarrage) et web/scripts/migrer-base.mjs
// (manuel). Conserve sans effet, ne pas supprimer (historique).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});