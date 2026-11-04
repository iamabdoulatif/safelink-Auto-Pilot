// Une regle d'audit = une question fermee sur la configuration collectee.
// Elle ne fait AUCUN appel reseau : elle lit le releve deja stocke.
import type { AppelRest } from "./correctif";

// Un releve, vu par l'audit : l'identifiant ne sert pas ici, seul le JSON
// brut compte. Chaque entree est un objet (une section du routeur).
export type Releve = { donnees: Record<string, Record<string, unknown>> };

export type Regle = {
code: string; // 'dns.serveurs-absents'
titre: string;
gravite: "critique" | "majeure" | "mineure" | "information";
categorie: "configuration";
// verifie() renvoie null si tout va bien, sinon le constat.
verifie: (releve: Releve) => { constat: string; cible?: string;
correctif?: AppelRest[] } | null;
};
export const REGLES_AUDIT: Regle[] = [
{
code: "dns.serveurs-absents",
titre: "Aucun serveur DNS configure",
gravite: "majeure",
categorie: "configuration",
verifie: (r) => {
const dns = r.donnees["ip/dns"];
const serveurs = String(dns?.serveurs ?? "").trim();
if (serveurs) return null;
return {
constat: "Le routeur n'a aucun serveur DNS. Les clients ne pourront pas "
+ "resoudre les noms de domaine, meme avec Internet fonctionnel.",
cible: "/ip/dns",
// Le correctif est un PLAN, pas une execution : il sera affiche,
// approuve, sauvegarde, puis joue par lib/diagnostic/correctif.ts
correctif: [{ methode: "PATCH", chemin: "/ip/dns",
corps: { servers: "1.1.1.1,8.8.8.8" } }],
};
},
},
{
code: "ntp.inactif",
titre: "Horloge non synchronisee",
gravite: "majeure",
categorie: "configuration",
verifie: (r) => {
const ntp = r.donnees["system/ntp/client"];
if (String(ntp?.enabled) === "true") return null;
return {
constat: "Le client NTP est desactive. Sans heure juste, les durees des "
+ "tickets Hotspot et les certificats se comportent mal.",
cible: "/system/ntp/client",
correctif: [{ methode: "PATCH", chemin: "/system/ntp/client",
corps: { enabled: "yes", servers: "time.google.com" } }],
};
},
},
// ... les 18 autres, meme forme exactement
];
