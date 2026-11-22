// Clôture d'un rapport des ventes : le workflow n8n (« Marquer le rapport
// envoyé ») appelle /rapports/<id>/termine. Même contrat signé que le POST
// de /rapports/<id> ; sans cette route, le rapport restait « demande ».
export { POST } from "../route";
