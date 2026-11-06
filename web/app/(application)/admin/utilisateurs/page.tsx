import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sessionPage } from "@/lib/session";
import { estSuperAdmin } from "@/lib/superadmin";
import {
  estAdminPlateforme,
  listerUtilisateurs,
} from "@/lib/admin-utilisateurs";
import { ActionsUtilisateurAdmin } from "@/components/actions-utilisateur-admin";
import type { RolePlateforme } from "@/lib/roles-plateforme";
import { Pastille } from "@/components/carte-routeur";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Supervision superadmin : tous les inscrits et l'état de leur parc.
// Réservé aux courriels de SUPERADMIN_COURRIELS (environnement serveur) ;
// les autres sont renvoyés vers leur tableau de bord.
export default async function PageAdminUtilisateurs() {
  await connection();
  const { utilisateurId } = await sessionPage();
  if (!(await estAdminPlateforme(utilisateurId))) redirect("/");
  const superAdmin = estSuperAdmin(utilisateurId);

  const utilisateurs = await listerUtilisateurs();
  const totalRouteurs = utilisateurs.reduce((s, u) => s + u.routeurs, 0);
  const totalCritiques = utilisateurs.reduce((s, u) => s + u.critiques, 0);
  const totalMajeurs = utilisateurs.reduce((s, u) => s + u.majeurs, 0);
  const sains = utilisateurs.filter((u) => u.critiques === 0 && u.majeurs === 0).length;
  const maxRouteurs = Math.max(1, ...utilisateurs.map((u) => u.routeurs));
  const totalStatuts = Math.max(1, totalCritiques + totalMajeurs + sains);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="hero-entree">
        <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Tous les comptes inscrits et l&apos;état de leurs équipements.
          Cliquez sur un utilisateur pour voir son parc en détail.
        </p>
      </div>

      <div className="hero-entree grid gap-4 sm:grid-cols-3" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comptes inscrits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold tabular-nums">{utilisateurs.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalRouteurs} routeur{totalRouteurs > 1 ? "s" : ""} surveillé
              {totalRouteurs > 1 ? "s" : ""} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Constats ouverts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm">
              <Pastille couleur="rouge" /> {totalCritiques} critique{totalCritiques > 1 ? "s" : ""}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Pastille couleur="ambre" /> {totalMajeurs} majeur{totalMajeurs > 1 ? "s" : ""}
            </p>
            {/* Répartition graphique des états, en une barre. */}
            <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-secondary">
              <div className="bg-status-critique" style={{ width: `${(totalCritiques / totalStatuts) * 100}%` }} />
              <div className="bg-status-majeur" style={{ width: `${(totalMajeurs / totalStatuts) * 100}%` }} />
              <div className="bg-status-ok" style={{ width: `${(sains / totalStatuts) * 100}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {sains} espace{sains > 1 ? "s" : ""} sans constat ouvert
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parcs les plus grands</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold tabular-nums">{maxRouteurs === 1 && totalRouteurs === 0 ? 0 : maxRouteurs}</p>
            <p className="mt-1 text-sm text-muted-foreground">routeurs chez l&apos;espace le plus équipé</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hero-entree" style={{ animationDelay: "160ms" }}>
        <CardContent className="px-0 py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Routeurs</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="pr-4">Dernier relevé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilisateurs.map((u) => (
                <TableRow key={u.courriel}>
                  <TableCell className="pl-4">
                    <Link
                      href={`/admin/utilisateurs/${encodeURIComponent(u.courriel)}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {u.prenom || u.nom ? `${u.prenom ?? ""} ${u.nom ?? ""}`.trim() : u.courriel}
                    </Link>
                    <BadgeRole role={u.role} />
                    <span className="block text-xs text-muted-foreground">
                      {u.courriel} · inscrit le {new Date(u.inscritLe).toLocaleDateString("fr-FR")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ActionsUtilisateurAdmin
                      courriel={u.courriel}
                      role={u.role}
                      superAdmin={superAdmin}
                      moi={utilisateurId}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(u.routeurs / maxRouteurs) * 100}%` }}
                        />
                      </div>
                      <span className="tabular-nums">{u.routeurs}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.critiques > 0 ? (
                      <Badge variant="destructive">
                        <Pastille couleur="rouge" />
                        {u.critiques} critique{u.critiques > 1 ? "s" : ""}
                      </Badge>
                    ) : u.majeurs > 0 ? (
                      <Badge variant="outline" className="border-status-majeur/30 bg-status-majeur/10 text-status-majeur">
                        <Pastille couleur="ambre" />
                        {u.majeurs} majeur{u.majeurs > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Pastille couleur="vert" />
                        Sous contrôle
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {u.dernierReleve
                      ? new Date(u.dernierReleve).toLocaleString("fr-FR")
                      : "jamais"}
                  </TableCell>
                </TableRow>
              ))}
              {utilisateurs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucun utilisateur inscrit pour le moment.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}


const LIBELLES_ROLE: Record<RolePlateforme, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  contributeur: "Contributeur",
};

function BadgeRole({ role }: { role: RolePlateforme }) {
  if (role === "superadmin") {
    return (
      <Badge className="ml-2 border-transparent bg-[var(--signal)] text-white">
        {LIBELLES_ROLE[role]}
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge variant="secondary" className="ml-2">
        {LIBELLES_ROLE[role]}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="ml-2">
      {LIBELLES_ROLE[role]}
    </Badge>
  );
}
