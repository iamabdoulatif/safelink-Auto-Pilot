import { EntetePage } from "@/components/entete-page";
import { GestionMembres } from "@/components/gestion-membres";
import { listerMembres, roleDansEspace } from "@/lib/membres";
import { sessionPage } from "@/lib/session";

// Membres de l'espace courant et leurs rôles. Tout membre consulte la
// liste ; seuls les admins invitent, changent les rôles et retirent.
export default async function PageMembres() {
  const ctx = await sessionPage();
  const membres = await listerMembres(ctx.tenantId);
  const monRole = await roleDansEspace(ctx.tenantId, ctx.utilisateurId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <EntetePage
        titre="Membres de l'espace"
        description="Qui peut faire quoi dans cet espace : les admins gèrent tout, les gérants génèrent et envoient les tickets, les vendeurs consultent et reçoivent les tickets à vendre."
      />
      <GestionMembres
        membres={membres.map((m) => ({
          courriel: m.courriel,
          role: m.role,
          invitePar: m.invitePar,
          compteExiste: m.compteExiste,
        }))}
        monRole={monRole}
        proprietaire={ctx.tenantId}
        moi={ctx.utilisateurId}
      />
    </main>
  );
}
