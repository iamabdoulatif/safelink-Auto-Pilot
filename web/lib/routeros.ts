import { Agent } from "undici";

// Politique TLS : le certificat est VERIFIE par defaut. Le labo local
// (certificat autosigne) s'autorise uniquement via ROUTEROS_TLS_INSECURE
// explicite ("1", "true" ou "oui"), jamais en production, et jamais en
// silence (avertissement). UNIQUEMENT cote serveur : ce fichier ne doit
// jamais etre importe depuis un composant "use client".
export function politiqueTls(
  env: Record<string, string | undefined>,
  production: boolean,
): { verifier: boolean; avertir: boolean } {
  const demande = (env.ROUTEROS_TLS_INSECURE ?? "").trim().toLowerCase();
  const explicite = demande === "1" || demande === "true" || demande === "oui";
  if (explicite && !production) return { verifier: false, avertir: true };
  return { verifier: true, avertir: explicite && production };
}

const agentLabo = new Agent({ connect: { rejectUnauthorized: false } });
let avertissementAffiche = false;

function dispatcher() {
  const { verifier, avertir } = politiqueTls(
    process.env, process.env.NODE_ENV === "production");
  if (avertir && !avertissementAffiche) {
    avertissementAffiche = true;
    console.warn(
      "[routeros] Certificat NON vérifié (ROUTEROS_TLS_INSECURE, labo uniquement).");
  }
  return verifier ? undefined : agentLabo;
}

function entete(user: string, pass: string) {
  return "Basic " + Buffer.from(user + ":" + pass).toString("base64");
}

type Methode = "GET" | "PUT" | "PATCH" | "DELETE" | "POST";

async function requete<T>(base: string, auth: string, chemin: string,
  methode: Methode, corps?: unknown): Promise<T> {
  const agent = dispatcher();
  const res = await fetch(base + "/rest" + chemin, {
    method: methode,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),   // un routeur lent ne bloque pas l'app
    ...(agent ? { dispatcher: agent } : {}),
  });
  if (!res.ok) {
    throw new ErreurRouterOS(res.status, chemin, await res.text());
  }
  const txt = await res.text();          // DELETE renvoie parfois un corps vide
  return txt ? JSON.parse(txt) : (undefined as T);
}

export class ErreurRouterOS extends Error {
  statut: number;
  chemin: string;
  detail: string;
  constructor(statut: number, chemin: string, detail: string) {
    // Message pour NOS journaux. Jamais renvoye tel quel au navigateur.
    super("RouterOS " + statut + " sur " + chemin);
    this.statut = statut;
    this.chemin = chemin;
    this.detail = detail;
  }
}

// Deux clients, deux comptes. C'est volontaire : le client de lecture ne PEUT
// PAS ecrire, meme si un bug le lui demandait.
function client(user?: string, pass?: string, base?: string) {
  const b = (base ?? process.env.ROUTEROS_URL!).replace(/\/$/, "");
  const a = entete(user!, pass!);
  return {
    get:    <T = unknown>(c: string)             => requete<T>(b, a, c, "GET"),
    add:    <T = unknown>(c: string, d: object)  => requete<T>(b, a, c, "PUT", d),
    set:    <T = unknown>(c: string, d: object)  => requete<T>(b, a, c, "PATCH", d),
    remove: <T = unknown>(c: string)             => requete<T>(b, a, c, "DELETE"),
    // print avec arguments : /interface/ethernet/print { "stats": "" }
    print:  <T = unknown>(c: string, d: object)  => requete<T>(b, a, c + "/print", "POST", d),
    // commande RouterOS (backup/save, export, scheduler...) en POST direct
    appel:  <T = unknown>(c: string, d: object)  => requete<T>(b, a, c, "POST", d),
  };
}

export const rosLecture = (base?: string) =>
  client(process.env.ROUTEROS_USER, process.env.ROUTEROS_PASS, base);

export const rosEcriture = (base?: string) =>
  client(process.env.ROUTEROS_FIX_USER, process.env.ROUTEROS_FIX_PASS, base);

// Client avec des identifiants fournis par l'utilisateur (configuration
// multi-utilisateur). Les secrets restent cote serveur et ne sont jamais
// journalises : en cas d'echec, seul le statut HTTP est conserve.
export const rosAvecIdentifiants = (
  base: string,
  utilisateur: string,
  motDePasse: string,
) => client(utilisateur, motDePasse, base);
