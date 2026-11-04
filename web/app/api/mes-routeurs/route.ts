import { session } from "@/lib/session";
import {
  listerInstallations,
} from "@/lib/mikhmon-installations";
import { lireConnexionRouteur } from "@/lib/connexions-routeur";

// « Mes routeurs » : chaque installation Mikhmon de l'espace, enrichie de
// sa partie RouterOS (adresse, serveurs, statut), sans aucun secret.
// Les tickets sont crees sur RouterOS et sont visibles automatiquement
// dans Mikhmon.
export async function GET() {
  const ctx = await session();
  try {
    const installations = await listerInstallations(ctx);
    const routeurs = [];
    for (const installation of installations) {
      const connexion = await lireConnexionRouteur(ctx, installation.id);
      routeurs.push({
        installation,
        routeur: connexion
          ? {
              adresse_routeros: connexion.adresseRouterOS,
              serveur_hotspot: connexion.serveurHotspot,
              statut_connexion: connexion.statutConnexion,
              dernier_test_le: connexion.dernierTestLe,
              correction_configuree: connexion.correctionConfiguree,
            }
          : null,
      });
    }
    return Response.json({ data: { routeurs } });
  } catch (e) {
    console.error("[mes-routeurs]", e);
    return Response.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
