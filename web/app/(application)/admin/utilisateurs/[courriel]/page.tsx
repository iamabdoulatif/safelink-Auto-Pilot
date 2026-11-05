import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { sessionPage } from "@/lib/session";
import { estSuperAdmin } from "@/lib/superadmin";
import {
  listerRouteursUtilisateur,
  utilisateurExiste,
} from "@/lib/admin-utilisateurs";
import { CarteRouteur } from "@/components/carte-routeur";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Vue superadmin d'un espace : l'état des équipements de cet utilisateur,
// en lecture seule (aucune action d'écriture depuis cette vue).
export default async function PageAdminUtilisateur({
  params,
}: {
  params: Promise<{ courriel: string }>;
}) {
  await connection();
  const { utilisateurId } = await sessionPage();
  if (!estSuperAdmin(utilisateurId)) redirect("/");

  const courriel = decodeURIComponent((await params).courriel);
  if (!(await utilisateurExiste(courriel))) notFound();

  const routeurs = await listerRouteursUtilisateur(courriel);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="hero-entree flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link href="/admin/utilisateurs">
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Tous les utilisateurs
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{courriel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Équipements de cet espace, en lecture seule :{" "}
            {routeurs.length} routeur{routeurs.length > 1 ? "s" : ""} surveillé
            {routeurs.length > 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      {routeurs.length === 0 ? (
        <Card className="hero-entree border-dashed" style={{ animationDelay: "80ms" }}>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="font-display text-xl">Aucun routeur enregistré</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Cet utilisateur n&apos;a pas encore ajouté d&apos;équipement à
              surveiller.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {routeurs.map((r, i) => (
            <CarteRouteur
              key={r.id}
              routeur={r}
              tenantId={courriel}
              delai={80 + i * 70}
            />
          ))}
        </div>
      )}
    </main>
  );
}
