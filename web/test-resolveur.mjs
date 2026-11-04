// Point d'entree du crochet de resolution (voir test-crochets.mjs).
// Charge par : node --test --import ./test-resolveur.mjs
import { register } from "node:module";

register("./test-crochets.mjs", import.meta.url);
