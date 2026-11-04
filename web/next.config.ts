import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // L'application est ouverte via 127.0.0.1 : autoriser le HMR sur cet
  // hote, sinon le rechargement a chaud reste bloque et les nouveaux
  // boutons semblent morts.
  allowedDevOrigins: ["127.0.0.1"],
  // Pas de cacheComponents / partialPrefetching : aucune page n'utilise
  // "use cache" et ces modes experimentaux font planter Turbopack en dev
  // (Runtime TypeError chunk.reason.enqueueModel is not a function).
  turbopack: {
    // Racine = ce dossier : Turbopack utilise web/package-lock.json
    // et ignore le lockfile de la racine (backend hors Next).
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
