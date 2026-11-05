// Nature d'un job de reapprovisionnement. Une regle en pause jamais simulee
// part toujours en simulation (lecture seule) : sinon elle ne pourrait jamais
// remplir la condition d'activation. Pure : aucune requete.
export function modeJobReappro(
  regle: { actif: boolean; simulationReussie: boolean; stockRearme: boolean },
  simulationGlobale: boolean,
): { simulation: boolean; surveillance: boolean } {
  const simulation = simulationGlobale ||
    (!regle.actif && !regle.simulationReussie);
  return { simulation, surveillance: !simulation && !regle.stockRearme };
}
