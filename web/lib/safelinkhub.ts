import { db } from "@/lib/db";
import { chiffrer, dechiffrer } from "@/lib/chiffrement";
import type { RouteurSafelinkhub } from "@/lib/safelinkhub-import";

export type { RouteurSafelinkhub } from "@/lib/safelinkhub-import";
export { versFormulaireMikhmon } from "@/lib/safelinkhub-import";

// Liaison avec SafeLinkHub (slh-app, même VPS, réseau Docker partagé).
// SafeLinkHub reste le SEUL gestionnaire WireGuard : on lit ici la liste
// des routeurs déjà connectés et on les joint par leur IP de tunnel
// (10.66.0.x), sans jamais créer de second tunnel sur un routeur.
// Aucun mot de passe ne transite : les comptes RouterOS / Mikhmon restent
// saisis dans Auto-Pilot.

const base = () => (process.env.SAFELINKHUB_INTERNAL_URL || "http://slh-app:3000").replace(/\/+$/, "");

function entetes(extra: Record<string, string> = {}): Record<string, string> {
  const jeton = process.env.SAFELINKHUB_INTERNAL_TOKEN;
  if (!jeton) throw new Error("Liaison SafeLinkHub non configurée sur ce serveur (SAFELINKHUB_INTERNAL_TOKEN).");
  return { authorization: "Bearer " + jeton, ...extra };
}

export async function lireLiaison(tenantId: string): Promise<{ organisation: string; jeton: string } | null> {
  const { rows } = await db.query<{ organisation: string; jeton_chiffre: string }>(
    "SELECT organisation, jeton_chiffre FROM liaisons_safelinkhub WHERE tenant_id = $1",
    [tenantId],
  );
  return rows[0] ? { organisation: rows[0].organisation, jeton: dechiffrer(rows[0].jeton_chiffre) } : null;
}

export async function lierSafelinkhub(tenantId: string, code: string): Promise<string> {
  const r = await fetch(base() + "/api/internal/autopilot/link", {
    method: "POST",
    headers: entetes({ "content-type": "application/json" }),
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(10000),
  });
  const j = (await r.json().catch(() => ({}))) as { token?: string; orgName?: string; error?: string };
  if (!r.ok || !j.token || !j.orgName) throw new Error(j.error ?? "SafeLinkHub injoignable.");
  await db.query(
    `INSERT INTO liaisons_safelinkhub (tenant_id, jeton_chiffre, organisation)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET jeton_chiffre = EXCLUDED.jeton_chiffre,
       organisation = EXCLUDED.organisation, lie_le = now()`,
    [tenantId, chiffrer(j.token), j.orgName],
  );
  return j.orgName;
}

export async function routeursSafelinkhub(tenantId: string): Promise<{ organisation: string; routeurs: RouteurSafelinkhub[] } | null> {
  const liaison = await lireLiaison(tenantId);
  if (!liaison) return null;
  const r = await fetch(base() + "/api/internal/autopilot/routers", {
    headers: entetes({ "x-slh-link": liaison.jeton }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const j = (await r.json().catch(() => ({}))) as { routers?: RouteurSafelinkhub[]; orgName?: string; error?: string };
  if (r.status === 401) throw new Error("Liaison révoquée dans SafeLinkHub : saisissez un nouveau code.");
  if (!r.ok || !j.routers) throw new Error(j.error ?? "SafeLinkHub injoignable.");
  return { organisation: j.orgName ?? liaison.organisation, routeurs: j.routers };
}

export async function delierSafelinkhub(tenantId: string): Promise<void> {
  await db.query("DELETE FROM liaisons_safelinkhub WHERE tenant_id = $1", [tenantId]);
}

async function appelInterne<T>(tenantId: string, chemin: string, corps: unknown): Promise<T> {
  const liaison = await lireLiaison(tenantId);
  if (!liaison) throw new Error("Espace non lié à SafeLinkHub : saisissez d'abord un code de liaison.");
  const r = await fetch(base() + chemin, {
    method: "POST",
    headers: entetes({ "content-type": "application/json", "x-slh-link": liaison.jeton }),
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(45000),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (r.status === 401) throw new Error("Liaison révoquée dans SafeLinkHub : saisissez un nouveau code.");
  if (!r.ok) throw new Error(j.error ?? "SafeLinkHub injoignable.");
  return j;
}

// Ligne à coller dans le terminal MikroTik (générée par SafeLinkHub, seul
// gestionnaire WireGuard). Si le routeur porte déjà le tunnel SafeLinkHub,
// elle n'installe rien et le routeur est reconnu par synchroniserParc.
export async function scriptInstallation(tenantId: string, nom: string): Promise<string> {
  const j = await appelInterne<{ command: string }>(tenantId, "/api/internal/autopilot/install", { name: nom });
  return j.command;
}

// Comptes RouterOS d'Auto-Pilot (variables ROUTEROS_*), posés sur le routeur
// par SafeLinkHub via sa propre connexion : aucun mot de passe dans un script.
function comptesAutoPilot() {
  const comptes: { name: string; password: string; access: "read" | "write" }[] = [];
  const { ROUTEROS_USER, ROUTEROS_PASS, ROUTEROS_FIX_USER, ROUTEROS_FIX_PASS } = process.env;
  if (ROUTEROS_USER && ROUTEROS_PASS) comptes.push({ name: ROUTEROS_USER, password: ROUTEROS_PASS, access: "read" });
  if (ROUTEROS_FIX_USER && ROUTEROS_FIX_PASS) comptes.push({ name: ROUTEROS_FIX_USER, password: ROUTEROS_FIX_PASS, access: "write" });
  if (!comptes.length) throw new Error("Compte de lecture RouterOS non configuré sur ce serveur (ROUTEROS_USER).");
  return comptes;
}

export type ResultatSynchro = { ajoutes: string[]; misAJour: string[]; erreurs: string[] };

// Reconnaît automatiquement les routeurs SafeLinkHub (en ligne) absents du
// parc : comptes posés par SafeLinkHub, lecture REST vérifiée par le tunnel,
// puis inscription. Un routeur du parc portant le même nom est repassé sur
// l'adresse du tunnel au lieu d'être dupliqué.
export async function synchroniserParc(tenantId: string): Promise<ResultatSynchro> {
  const res: ResultatSynchro = { ajoutes: [], misAJour: [], erreurs: [] };
  const liste = await routeursSafelinkhub(tenantId);
  if (!liste) return res;
  const { rows } = await db.query<{ id: number; nom: string; url_base: string }>(
    "SELECT id, nom, url_base FROM routeurs WHERE tenant_id = $1",
    [tenantId],
  );
  const { rosLecture } = await import("@/lib/routeros");
  const { rows: [l] } = await db.query<{ exclus: string[] }>(
    "SELECT exclus FROM liaisons_safelinkhub WHERE tenant_id = $1",
    [tenantId],
  );
  const exclus = new Set(l?.exclus ?? []);
  const nouveaux: number[] = [];
  for (const r of liste.routeurs) {
    if (!r.online || exclus.has(r.id)) continue;
    const memeUrl = rows.find((x) => x.url_base === r.routerosUrl);
    if (memeUrl) continue;
    const memeNom = rows.find((x) => x.nom.trim().toLowerCase() === r.name.trim().toLowerCase());
    try {
      await appelInterne(tenantId, "/api/internal/autopilot/accounts", { routerId: r.id, accounts: comptesAutoPilot() });
      await rosLecture(r.routerosUrl).get("/system/identity");
      if (memeNom) {
        await db.query("UPDATE routeurs SET url_base = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3", [r.routerosUrl, memeNom.id, tenantId]);
        nouveaux.push(memeNom.id);
        res.misAJour.push(r.name);
      } else {
        const { rows: [ajout] } = await db.query<{ id: number }>(
          "INSERT INTO routeurs (nom, url_base, tenant_id) VALUES ($1, $2, $3) RETURNING id",
          [r.name, r.routerosUrl, tenantId],
        );
        nouveaux.push(ajout.id);
        res.ajoutes.push(r.name);
      }
    } catch (e) {
      res.erreurs.push(r.name + " : " + (e instanceof Error ? e.message : "échec"));
    }
  }
  // Premier relevé tout de suite : la carte affiche CPU/RAM dès l'ajout.
  if (nouveaux.length) {
    const { releverParc } = await import("@/lib/diagnostic/releve-parc");
    await releverParc({ ids: nouveaux });
  }
  return res;
}

// Adresse de tunnel (10.66.0.x) : réservée aux routeurs de l'organisation
// SafeLinkHub liée à l'espace. Sans ce contrôle, un espace pourrait inscrire
// le routeur d'un autre (même compte de lecture global sur tout le parc).
export async function adresseTunnelAutorisee(tenantId: string, urlBase: string): Promise<boolean> {
  const hote = /^https?:\/\/([^/:]+)/i.exec(urlBase)?.[1] ?? "";
  if (!hote.startsWith("10.66.")) return true;
  const liste = await routeursSafelinkhub(tenantId).catch(() => null);
  return !!liste?.routeurs.some((r) => r.tunnelIp === hote);
}

// Retrait d'un routeur du parc : s'il vient de SafeLinkHub (adresse de
// tunnel), il est exclu de la reconnaissance automatique, sinon il
// reviendrait à la prochaine ouverture du tableau de bord.
export async function exclureDuParc(tenantId: string, urlBase: string): Promise<void> {
  if (!/^https?:\/\/10\.66\./i.test(urlBase)) return;
  const liste = await routeursSafelinkhub(tenantId).catch(() => null);
  const r = liste?.routeurs.find((x) => x.routerosUrl === urlBase);
  if (!r) return;
  await db.query(
    "UPDATE liaisons_safelinkhub SET exclus = array_append(exclus, $2) WHERE tenant_id = $1 AND NOT ($2 = ANY(exclus))",
    [tenantId, r.id],
  );
}
