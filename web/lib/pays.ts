// Pays proposés à l'inscription : drapeau, nom et indicatif.
// La Côte d'Ivoire (+225) est le choix par défaut ; l'indicatif choisi
// précède le numéro saisi et part avec le formulaire.
export type Pays = { nom: string; indicatif: string; drapeau: string };

export const PAYS: Pays[] = [
  { nom: "Côte d'Ivoire", indicatif: "+225", drapeau: "🇨🇮" },
  { nom: "Burkina Faso", indicatif: "+226", drapeau: "🇧🇫" },
  { nom: "Mali", indicatif: "+223", drapeau: "🇲🇱" },
  { nom: "Sénégal", indicatif: "+221", drapeau: "🇸🇳" },
  { nom: "Guinée", indicatif: "+224", drapeau: "🇬🇳" },
  { nom: "Bénin", indicatif: "+229", drapeau: "🇧🇯" },
  { nom: "Togo", indicatif: "+228", drapeau: "🇹🇬" },
  { nom: "Niger", indicatif: "+227", drapeau: "🇳🇪" },
  { nom: "Cameroun", indicatif: "+237", drapeau: "🇨🇲" },
  { nom: "RD Congo", indicatif: "+243", drapeau: "🇨🇩" },
  { nom: "Congo", indicatif: "+242", drapeau: "🇨🇬" },
  { nom: "Gabon", indicatif: "+241", drapeau: "🇬🇦" },
  { nom: "Ghana", indicatif: "+233", drapeau: "🇬🇭" },
  { nom: "Nigeria", indicatif: "+234", drapeau: "🇳🇬" },
  { nom: "Maroc", indicatif: "+212", drapeau: "🇲🇦" },
  { nom: "Algérie", indicatif: "+213", drapeau: "🇩🇿" },
  { nom: "Tunisie", indicatif: "+216", drapeau: "🇹🇳" },
  { nom: "Mauritanie", indicatif: "+222", drapeau: "🇲🇷" },
  { nom: "France", indicatif: "+33", drapeau: "🇫🇷" },
  { nom: "Belgique", indicatif: "+32", drapeau: "🇧🇪" },
  { nom: "Suisse", indicatif: "+41", drapeau: "🇨🇭" },
  { nom: "Canada", indicatif: "+1", drapeau: "🇨🇦" },
  { nom: "États-Unis", indicatif: "+1", drapeau: "🇺🇸" },
];

export const PAYS_DEFAUT: Pays = PAYS[0];
