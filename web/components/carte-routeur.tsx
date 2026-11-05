import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionsParc } from "@/components/actions-parc";
import { MaterielRouteur } from "@/components/materiel-routeur";

// Carte d'un routeur du parc, partagée entre le tableau de bord de
// l'utilisateur (avec ses actions) et la vue superadmin (lecture seule).
const COULEURS_PASTILLE = {
  rouge: "bg-status-critique",
  ambre: "bg-status-majeur",
  vert: "bg-status-ok",
} as const;

export function Pastille({ couleur }: { couleur: keyof typeof COULEURS_PASTILLE }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", COULEURS_PASTILLE[couleur])}
    />
  );
}

export function StatutRouteur({ critiques, majeurs }: { critiques: number; majeurs: number }) {
  if (critiques > 0) {
    return (
      <Badge variant="destructive">
        <Pastille couleur="rouge" />
        {critiques} critique{critiques > 1 ? "s" : ""}
      </Badge>
    );
  }
  if (majeurs > 0) {
    return (
      <Badge variant="outline" className="border-status-majeur/30 bg-status-majeur/10 text-status-majeur">
        <Pastille couleur="ambre" />
        {majeurs} majeur{majeurs > 1 ? "s" : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Pastille couleur="vert" />
      Sous contrôle
    </Badge>
  );
}

export type RouteurCarte = {
  id: number;
  nom: string;
  url_base: string;
  modele: string | null;
  dernier_releve: Date | string | null;
  critiques: string;
  majeurs: string;
};

export function CarteRouteur({
  routeur,
  tenantId,
  avecActions = false,
  delai = 0,
}: {
  routeur: RouteurCarte;
  tenantId: string;
  avecActions?: boolean;
  delai?: number;
}) {
  const critiques = Number(routeur.critiques);
  const majeurs = Number(routeur.majeurs);
  return (
    <Card
      className="hero-entree transition-colors hover:border-foreground/25"
      style={{ animationDelay: `${delai}ms` }}
    >
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="truncate font-display text-xl">{routeur.nom}</CardTitle>
        <StatutRouteur critiques={critiques} majeurs={majeurs} />
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        {/* Suspense par carte : un routeur lent ne bloque pas le parc. */}
        <Suspense fallback={<Skeleton className="h-14 w-full" />}>
          <MaterielRouteur
            tenantId={tenantId}
            routeurId={routeur.id}
            urlBase={routeur.url_base}
            modeleConnu={routeur.modele}
          />
        </Suspense>
        <p className="text-muted-foreground">
          {/* La date du dernier relevé RÉUSSI : sans elle, un écran vert
              peut afficher l'état d'il y a trois jours. */}
          Dernier relevé :{" "}
          {routeur.dernier_releve
            ? new Date(routeur.dernier_releve).toLocaleString("fr-FR")
            : "jamais"}
        </p>
        {critiques > 0 || majeurs > 0 ? (
          <p className="mt-1 font-medium">
            {critiques > 0 && (
              <span className="text-status-critique">
                {critiques} critique{critiques > 1 ? "s" : ""}
              </span>
            )}
            {critiques > 0 && majeurs > 0 && <span> · </span>}
            {majeurs > 0 && (
              <span className="text-status-majeur">
                {majeurs} majeur{majeurs > 1 ? "s" : ""}
              </span>
            )}
          </p>
        ) : null}
        {avecActions ? (
          <div className="mt-2">
            <ActionsParc id={routeur.id} nom={routeur.nom} urlBase={routeur.url_base} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
