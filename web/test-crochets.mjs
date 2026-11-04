// Crochet de resolution pour les tests : traduit l'alias "@/..." du
// tsconfig vers un chemin reel. Usage : node --test --import
// ./test-resolveur.mjs lib/*.test.ts (depuis web/).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = join(RACINE, specifier.slice(2));
    for (const candidat of [base, base + ".ts", base + ".tsx", base + ".mjs", base + ".js"]) {
      if (existsSync(candidat)) {
        return { url: pathToFileURL(candidat).href, shortCircuit: true };
      }
    }
  }
  return next(specifier, context);
}
