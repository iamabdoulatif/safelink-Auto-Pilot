import { rosLecture } from "@/lib/routeros";
import { db } from "@/lib/db";

// La liste est volontairement figee et lisible : c'est le contrat de collecte.
const CHEMINS = [
  "system/resource", "system/health", "system/routerboard", "system/identity",
  "system/ntp/client", "system/clock", "system/logging", "system/scheduler",
  "interface", "interface/ethernet", "interface/bridge",
  "ip/dns", "ip/service", "ip/firewall/filter", "ip/firewall/nat",
  "ip/dhcp-server", "ip/dhcp-server/network", "ip/pool",
  "ip/hotspot", "ip/hotspot/profile", "ip/hotspot/user/profile",
  "ip/neighbor/discovery-settings", "user", "log",
];

export async function collecter(routeurId: number, urlBase: string) {
  const ros = rosLecture(urlBase);
  const debut = Date.now();
  const donnees: Record<string, unknown> = {};
  const manquants: string[] = [];

  // Un chemin absent sur ce modele ne fait PAS echouer la collecte : on note.
  for (const chemin of CHEMINS) {
    try {
      donnees[chemin] = await ros.get("/" + chemin);
    } catch {
      manquants.push(chemin);
    }
  }

  // Les erreurs physiques detaillees : print avec l'argument stats.
  try {
    donnees["interface/ethernet:stats"] =
      await ros.print("/interface/ethernet", { stats: "" });
  } catch {
    manquants.push("interface/ethernet:stats");
  }

  // La radio : on sonde les deux pilotes, celui qui repond gagne.
  for (const pilote of ["wifi", "wireless"]) {
    try {
      donnees["interface/" + pilote] = await ros.get("/interface/" + pilote);
      donnees["interface/" + pilote + "/registration-table"] =
        await ros.get("/interface/" + pilote + "/registration-table");
      donnees["_pilote_wifi"] = pilote;
      break;
    } catch { /* on essaie l'autre */ }
  }

  const statut = manquants.length === 0 ? "ok"
    : Object.keys(donnees).length === 0 ? "injoignable" : "partiel";

  const { rows } = await db.query(
    `INSERT INTO releves (routeur_id, duree_ms, statut, erreur, donnees)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [routeurId, Date.now() - debut, statut,
      manquants.length ? "chemins indisponibles: " + manquants.join(", ") : null,
      donnees]
  );
  return { releveId: rows[0].id as number, statut, manquants };
}
