import { EntetePage } from "@/components/entete-page";
import { HistoriqueClient } from "@/components/historique-client";

// Historique : par défaut les générations réelles. Les contrôles
// toutes les 15 minutes ont leur onglet, s'archivent seuls après
// 30 jours, et les archives se suppriment (admin, base uniquement).
export default function Historique() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <EntetePage
        titre="Historique"
        description="Générations manuelles et automatiques de votre espace. Les contrôles de stock de routine sont rangés à part et archivés après 30 jours. Aucun secret n'y figure."
      />
      <HistoriqueClient />
    </main>
  );
}
