import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { sessionPage } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AjouterParc } from "@/components/ajouter-parc";
import { CarteRouteur, Pastille } from "@/components/carte-routeur";

// Une ligne lue par la requête : les compteurs Postgres arrivent en texte,
// l'horodatage en Date ou en texte selon le pilote.
type LigneRouteur = {
  id: number;
  nom: string;
  url_base: string;
  modele: string | null;
  dernier_releve: Date | string | null;
  critiques: string;
  majeurs: string;
};

// Partie dynamique : connection() marque ce travail comme "au moment de la
// requête". Suspense, dans le parent, découpe la coquille statique juste ici.
async function ListeRouteurs() {
  await connection();
  // Isolation stricte : un espace ne voit que son propre parc.
  const { tenantId } = await sessionPage();
  const { rows } = await db.query<LigneRouteur>(
    `SELECT r.id, r.nom, r.url_base, r.modele,
      (SELECT max(mesure_le) FROM releves
        WHERE routeur_id = r.id AND statut <> 'injoignable') AS dernier_releve,
      count(c.id) FILTER (WHERE c.gravite = 'critique') AS critiques,
      count(c.id) FILTER (WHERE c.gravite = 'majeure') AS majeurs
    FROM routeurs r
    LEFT JOIN constats c ON c.routeur_id = r.id AND c.statut = 'ouvert'
    WHERE r.actif AND r.tenant_id = $1
    GROUP BY r.id ORDER BY r.nom`,
    [tenantId]);

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-display text-xl">Aucun routeur enregistré</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Ajoutez votre premier routeur pour lancer la surveillance :
            diagnostic matériel, Wi-Fi et audit de configuration.
          </p>
          <AjouterParc />
        </CardContent>
      </Card>
    );
  }

  const totalCritiques = rows.reduce((s, r) => s + Number(r.critiques), 0);
  const totalMajeurs = rows.reduce((s, r) => s + Number(r.majeurs), 0);
  const sousControle = rows.filter(
    (r) => Number(r.critiques) === 0 && Number(r.majeurs) === 0,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="hero-entree">
        <CardContent className="grid grid-cols-2 divide-x px-0 py-3 sm:grid-cols-4">
          <div className="flex flex-col items-center gap-0.5 px-2">
            <span className="inline-flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
              <Pastille couleur="rouge" />
              {totalCritiques}
            </span>
            <span className="text-xs text-muted-foreground">
              critique{totalCritiques > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2">
            <span className="inline-flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
              <Pastille couleur="ambre" />
              {totalMajeurs}
            </span>
            <span className="text-xs text-muted-foreground">
              majeur{totalMajeurs > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2">
            <span className="inline-flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
              <Pastille couleur="vert" />
              {sousControle}
            </span>
            <span className="text-xs text-muted-foreground">sous contrôle</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2">
            <span className="font-display text-2xl font-semibold tabular-nums">
              {rows.length}
            </span>
            <span className="text-xs text-muted-foreground">
              routeur{rows.length > 1 ? "s" : ""} surveillé
              {rows.length > 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r, i) => (
          <CarteRouteur
            key={r.id}
            routeur={r}
            tenantId={tenantId}
            avecActions
            delai={80 + i * 70}
          />
        ))}
      </div>
    </div>
  );
}

function Chargement() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}

// Coquille statique : le titre se pré-rend, la liste arrive en streaming.
export default function TableauDeBord() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="hero-entree flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parc de routeurs</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            État du parc, relevés réussis et constats ouverts — mis à jour à
            chaque visite.
          </p>
        </div>
        <AjouterParc />
      </div>
      <Suspense fallback={<Chargement />}>
        <ListeRouteurs />
      </Suspense>
    </main>
  );
}
