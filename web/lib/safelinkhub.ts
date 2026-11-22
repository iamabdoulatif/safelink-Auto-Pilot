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
