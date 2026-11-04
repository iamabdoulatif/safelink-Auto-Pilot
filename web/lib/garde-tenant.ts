// Garde-fous d'appartenance : une ligne lue en base n'est rendue que si
// son tenant_id egale le tenant de la session. Sinon 404 (et pas 403 :
// on ne revele pas l'existence d'une donnee d'un autre espace).
export class ErreurAcces extends Error {
  statut = 404 as const;
  constructor(message = "Introuvable.") {
    super(message);
    this.name = "ErreurAcces";
  }
}

export function exigerProprietaire<T extends { tenant_id: string }>(
  tenantId: string,
  ligne: T | null | undefined,
): T {
  if (!ligne || ligne.tenant_id !== tenantId) throw new ErreurAcces();
  return ligne;
}
