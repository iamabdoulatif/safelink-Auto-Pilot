import { rosEcriture } from "@/lib/routeros";
import { db } from "@/lib/db";

export type AppelRest = { methode: "PUT" | "PATCH" | "DELETE";
  chemin: string; corps?: object };

// Suppression interdite : on desactive (disabled=true), on ne supprime
// jamais. Le type exclut DELETE ; le garde-fou refuse aussi les plans
// historiques qui en contiendraient encore un.
const SUPPRESSION_INTERDITE = "Suppression interdite : désactiver (disabled=true), jamais supprimer.";

// Zones interdites a l'automatisation : on PROPOSE, on n'applique pas.
// C'est par la qu'on se coupe l'acces a distance. Le Wi-Fi
// (/interface/wireless) reste autorise : c'est l'objet du diagnostic.
const INTERDIT = [/^\/ip\/firewall\/filter/, /^\/ip\/service/,
  /^\/ip\/address/, /^\/ip\/route/, /^\/interface\/bridge/,
  /^\/interface\/ethernet/, /^\/interface\/vlan/,
  /^\/user/, /^\/system\/package/, /^\/system\/routerboard/];

// Valide un plan AVANT la sauvegarde et le premier appel : plan vide,
// suppression, zone sensible. Pur et testable, sans acces base ni reseau.
export function verifierPlan(plan: AppelRest[]): void {
  if (plan.length === 0) throw new Refus(403, "Aucun correctif automatisable.");
  for (const a of plan) {
    if (a.methode === "DELETE") throw new Refus(403, SUPPRESSION_INTERDITE);
    if (INTERDIT.some((re) => re.test(a.chemin)))
      throw new Refus(403, "Zone sensible (" + a.chemin + ") : correctif a "
        + "appliquer a la main, en gardant un acces de secours.");
  }
}

export async function appliquer(constatId: number, approuvePar: string) {
  const { rows } = await db.query(
    `SELECT c.id, c.routeur_id, c.correctif, c.categorie, c.statut, r.url_base
     FROM constats c JOIN routeurs r ON r.id = c.routeur_id
     WHERE c.id = $1`, [constatId]);
  const c = rows[0];

  // --- Les refus, avant toute chose -------------------------------------
  if (!c) throw new Refus(404, "Constat inconnu.");
  if (c.statut === "corrige") throw new Refus(409, "Deja corrige.");
  if (c.categorie !== "configuration")
    throw new Refus(403, "Ce constat est materiel ou environnemental : "
      + "aucun correctif logiciel ne peut le regler.");
  verifierPlan((c.correctif ?? []) as AppelRest[]);

  const ros = rosEcriture(c.url_base);

  // --- 1) Sauvegarder --------------------------------------------------
  const nom = "autopilot-" + new Date().toISOString().replace(/[:.]/g, "-");
  await ros.add("/system/backup/save", { name: nom });

  const planValide = (c.correctif ?? []) as AppelRest[];
  const { rows: cr } = await db.query<{ id: number }>(
    `INSERT INTO correctifs (constat_id, routeur_id, plan, sauvegarde_nom,
      approuve_par, approuve_le, statut)
     VALUES ($1,$2,$3,$4,$5,now(), 'approuve') RETURNING id`,
    [c.id, c.routeur_id, JSON.stringify(planValide), nom, approuvePar]);
  if (cr.length === 0) throw new Refus(500, "Correctif non enregistré.");

  const correctifId = cr[0].id;

  // --- 2) Appliquer, un appel a la fois -------------------------------
  const resultats: unknown[] = [];
  try {
    for (const a of planValide) {
      const r = a.methode === "PUT"   ? await ros.add(a.chemin, a.corps ?? {})
        : a.methode === "PATCH" ? await ros.set(a.chemin, a.corps ?? {})
        : (() => { throw new Refus(403, SUPPRESSION_INTERDITE); })();
      resultats.push({ appel: a, ok: true, reponse: r ?? null });
    }
  } catch (e) {
    // Premier echec = arret. On ne joue pas la suite d'un plan casse.
    await db.query(
      'UPDATE correctifs SET statut=\'echoue\', resultat=$2, applique_le=now() WHERE id=$1',
      [correctifId, JSON.stringify({ resultats, erreur: String(e) })]);
    throw e;
  }

  // --- 3) Verifier : l'etat attendu, PUIS que le routeur repond encore ---
  const toujoursLa = await ros.get("/system/identity")
    .then(() => true).catch(() => false);

  await db.query(
    'UPDATE correctifs SET statut=\'applique\', applique_le=now(), resultat=$2, verifie=$3 WHERE id=$1',
    [correctifId, JSON.stringify(resultats), toujoursLa]);
  await db.query(
    'UPDATE constats SET statut=\'corrige\', dernier_vu_le=now() WHERE id=$1', [c.id]);

  return { correctifId, sauvegarde: nom, appels: planValide.length, verifie: toujoursLa };
}

export class Refus extends Error {
  statut: number;
  constructor(statut: number, message: string) {
    super(message);
    this.statut = statut;
  }
}
