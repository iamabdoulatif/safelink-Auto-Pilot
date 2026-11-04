import { Agent } from "undici";

// Le routeur presente un certificat qu'il signe lui-meme : Node le refuse par
// defaut. On cree un "dispatcher" qui l'accepte. UNIQUEMENT cote serveur : ce
// fichier ne doit jamais etre importe depuis un composant "use client".
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

function entete(user: string, pass: string) {
  return "Basic " + Buffer.from(user + ":" + pass).toString("base64");
}

type Methode = "GET" | "PUT" | "PATCH" | "DELETE" | "POST";

async function requete<T>(base: string, auth: string, chemin: string,
  methode: Methode, corps?: unknown): Promise<T> {
  const res = await fetch(base + "/rest" + chemin, {
    method: methode,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),   // un routeur lent ne bloque pas l'app
    // @ts-expect-error -- "dispatcher" existe dans le fetch de Node (undici)
    dispatcher,
  });
  if (!res.ok) {
    throw new ErreurRouterOS(res.status, chemin, await res.text());
  }
  const txt = await res.text();          // DELETE renvoie parfois un corps vide
  return txt ? JSON.parse(txt) : (undefined as T);
}

export class ErreurRouterOS extends Error {
  constructor(public statut: number, public chemin: string, public detail: string) {
    // Message pour NOS journaux. Jamais renvoye tel quel au navigateur.
    super("RouterOS " + statut + " sur " + chemin);
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
  };
}

export const rosLecture = (base?: string) =>
  client(process.env.ROUTEROS_USER, process.env.ROUTEROS_PASS, base);

export const rosEcriture = (base?: string) =>
  client(process.env.ROUTEROS_FIX_USER, process.env.ROUTEROS_FIX_PASS, base);
