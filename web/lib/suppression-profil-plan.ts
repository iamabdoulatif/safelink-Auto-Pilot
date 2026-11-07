// Plan de suppression d'un profil : logique pure, testable.
// La partie base et réseau vit dans lib/suppression-profil.

export type ObjetRos = Record<string, unknown>;

export type PlanSuppression = {
  profilId: string | null;
  total: number;
  neufs: number;
  utilises: number;
  idsTickets: string[];
};

function estNeuf(u: ObjetRos): boolean {
  const uptime = String(u["uptime"] ?? "0s").trim();
  return uptime === "0s" || uptime === "0" || uptime === "";
}

// Plan pur, testable : retrouve le profil et ses tickets.
export function planSuppressionProfil(
  nomProfil: string,
  profils: ObjetRos[],
  utilisateurs: ObjetRos[],
): PlanSuppression {
  const profil = profils.find((p) => String(p["name"] ?? "") === nomProfil);
  const duProfil = utilisateurs.filter(
    (u) => String(u["profile"] ?? "") === nomProfil);
  return {
    profilId: profil ? String(profil[".id"] ?? "") || null : null,
    total: duProfil.length,
    neufs: duProfil.filter(estNeuf).length,
    utilises: duProfil.filter((u) => !estNeuf(u)).length,
    idsTickets: duProfil
      .map((u) => String(u[".id"] ?? ""))
      .filter(Boolean),
  };
}

export function nomSauvegarde(profil: string, quand = new Date()): string {
  const propre = profil.replace(/[^A-Za-z0-9_-]/g, "-");
  const horo = quand.toISOString().replace(/[:.]/g, "-");
  return `avant-suppression-${propre}-${horo}`;
}

// Lignes du plan exact affichées à l'humain avant approbation.
export function lignesDuPlan(
  plan: PlanSuppression,
  sauvegarde: string,
  filet: string,
): string[] {
  const lignes = [
    `POST /system/backup/save {"name":"${sauvegarde}"}`,
    `PUT /system/scheduler {"name":"${filet}","on-event":"/system/backup/load name=${sauvegarde}"} (filet, désactivé après vérification)`,
  ];
  // RouterOS ne sait pas désactiver un profil Hotspot (vérifié par
  // /console/inspect : aucun argument disabled sur user/profile).
  // Procédure : désactiver chaque ticket, vérifier, puis supprimer
  // définitivement tickets et profil (exception propriétaire du
  // 2026-11-07 dans AGENTS.md, sauvegarde et filet en place).
  for (const id of plan.idsTickets) {
    lignes.push(`PATCH /ip/hotspot/user/${id} {"disabled":true}`);
  }
  for (const id of plan.idsTickets) {
    lignes.push(`DELETE /ip/hotspot/user/${id}`);
  }
  if (plan.profilId) {
    lignes.push(`DELETE /ip/hotspot/user/profile/${plan.profilId}`);
  }
  return lignes;
}

