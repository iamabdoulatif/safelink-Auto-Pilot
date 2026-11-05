import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { sessionPage } from "@/lib/session";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EntetePage } from "@/components/entete-page";

type LigneConstat = {
  regle: string;
  categorie: string;
  gravite: string;
  cible: string | null;
  titre: string;
  constat: string;
  routeur_nom: string;
};

// Diagnostics : constats ouverts du parc de l'espace (materiel, Wi-Fi,
// configuration). Le diagnostic utilise le compte lecture seule et
// n'ecrit jamais sur le routeur.
async function Constats() {
  await connection();
  const { tenantId } = await sessionPage();
  const { rows } = await db.query<LigneConstat>(
    `SELECT c.regle, c.categorie, c.gravite, c.cible, c.titre,
       c.constat, r.nom AS routeur_nom
     FROM constats c
     JOIN routeurs r ON r.id = c.routeur_id
     WHERE c.statut = 'ouvert' AND r.tenant_id = $1
     ORDER BY
       CASE c.gravite
         WHEN 'critique' THEN 0 WHEN 'majeure' THEN 1
         WHEN 'mineure' THEN 2 ELSE 3
       END,
       r.nom`,
    [tenantId],
  );
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="font-medium">Aucun constat ouvert</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Le parc est sous contrôle pour cet espace.
          </p>
        </CardContent>
      </Card>
    );
  }
  const nbCritiques = rows.filter((c) => c.gravite === "critique").length;
  const nbMajeures = rows.filter((c) => c.gravite === "majeure").length;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2" aria-label="Résumé des constats">
        <li>
          <Badge variant="destructive">{nbCritiques} critique{nbCritiques > 1 ? "s" : ""}</Badge>
        </li>
        <li>
          <Badge className="bg-signal text-white">{nbMajeures} majeure{nbMajeures > 1 ? "s" : ""}</Badge>
        </li>
        <li>
          <Badge variant="secondary">{rows.length} au total</Badge>
        </li>
      </ul>
      {rows.map((c, i) => (
        <Card key={c.regle + c.cible + i} className="transition-colors hover:border-foreground/25">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="truncate text-base">
              {c.routeur_nom} — {c.titre}
            </CardTitle>
            {c.gravite === "critique" ? (
              <Badge variant="destructive">{c.gravite}</Badge>
            ) : c.gravite === "majeure" ? (
              <Badge className="bg-signal text-white">{c.gravite}</Badge>
            ) : (
              <Badge variant="secondary">{c.gravite}</Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              {c.categorie}
              {c.cible ? " · " + c.cible : ""} · règle {c.regle}
            </p>
            <p>{c.constat}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Diagnostics() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <EntetePage
        titre="Diagnostics"
        description="Constats ouverts : matériel, Wi-Fi et configuration. Toute correction passe par une validation humaine préalable."
      />
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <Constats />
      </Suspense>
    </main>
  );
}
