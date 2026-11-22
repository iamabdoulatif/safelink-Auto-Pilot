// Types et conversion purs de l'import SafeLinkHub (testables sans base).

export type RouteurSafelinkhub = {
  id: string;
  name: string;
  online: boolean;
  tunnelIp: string;
  model: string | null;
  mikhmonVariant: "v3" | "sf-v1" | null;
  routerosUrl: string;
  mikhmonUrl: string | null;
};

// Champs du formulaire « connexion Mikhmon » déduits d'un routeur importé.
// Une adresse https (instance Mikhmon cloud) n'a pas d'hôte:port simple :
// on laisse l'hôte vide, à saisir à la main.
export function versFormulaireMikhmon(r: RouteurSafelinkhub): {
  nom: string;
  variante: string;
  hote: string;
  port: string;
} {
  const m = r.mikhmonUrl ? /^http:\/\/([^/:]+):(\d+)\//.exec(r.mikhmonUrl) : null;
  return {
    nom: r.name,
    variante: r.mikhmonVariant ?? "sf-v1",
    hote: m ? m[1] : "",
    port: m ? m[2] : "8088",
  };
}

