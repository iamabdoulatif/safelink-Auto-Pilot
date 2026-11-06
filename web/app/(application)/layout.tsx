import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { NavPrincipale } from "@/components/nav-principale";
import { NOM_COOKIE_SESSION, verifierSession } from "@/lib/session-cookie";
import { estAdminPlateforme } from "@/lib/admin-utilisateurs";
import { estSuperAdmin } from "@/lib/superadmin";

// Coquille de l'application connectée : menu latéral + zone de contenu.
// La page publique /accueil est hors de ce groupe : aucun menu d'application.
// Le groupe Administration du menu n'apparaît que pour un admin de
// plateforme ou un superadmin (vérifié ici, côté serveur).
export default async function LayoutApplication({ children }: { children: ReactNode }) {
  const secret = process.env.SESSION_SECRET ?? "";
  const valeur = (await cookies()).get(NOM_COOKIE_SESSION)?.value ?? null;
  const session = secret ? verifierSession(secret, valeur) : null;
  const superAdmin = session ? estSuperAdmin(session.utilisateurId) : false;
  const adminPlateforme = session
    ? await estAdminPlateforme(session.utilisateurId)
    : false;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavPrincipale superAdmin={superAdmin} adminPlateforme={adminPlateforme} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
