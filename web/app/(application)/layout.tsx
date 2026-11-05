import type { ReactNode } from "react";
import { NavPrincipale } from "@/components/nav-principale";

// Coquille de l'application connectée : menu latéral + zone de contenu.
// La page publique /accueil est hors de ce groupe : aucun menu d'application.
export default function LayoutApplication({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavPrincipale />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
