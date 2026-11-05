import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sessionPage } from "@/lib/session";
import { estSuperAdmin } from "@/lib/superadmin";
import { FormulaireParametresPlateforme } from "@/components/formulaire-parametres-plateforme";

// Paramètres de la plateforme, réglés par le superadmin : c'est ici
// que vivent le lien du groupe communautaire et le webhook du code
// WhatsApp, sans passer par les variables du serveur.
export default async function PageAdminParametres() {
  await connection();
  const { utilisateurId } = await sessionPage();
  if (!estSuperAdmin(utilisateurId)) redirect("/");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div className="hero-entree">
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres de la plateforme</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Réglages globaux de SafeLink, appliqués à tous les comptes. La liste
          des superadmins reste dans l&apos;environnement du serveur
          (SUPERADMIN_COURRIELS) : c&apos;est elle qui décide qui voit cette page.
        </p>
      </div>
      <div className="hero-entree" style={{ animationDelay: "80ms" }}>
        <FormulaireParametresPlateforme />
      </div>
    </main>
  );
}
