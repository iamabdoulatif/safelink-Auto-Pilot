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
  return (
    <div className="flex flex-col gap-2">
      {rows.map((c, i) => (
        <Card key={c.regle + c.cible + i}>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="truncate text-base">
              {c.routeur_nom} — {c.titre}
            </CardTitle>
            <Badge
              variant={c.gravite === "critique" ? "destructive" : "secondary"}
            >
              {c.gravite}
            </Badge>
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
      <div>
        <h1 className="text-2xl font-semibold">Diagnostics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Constats ouverts : matériel, Wi-Fi et configuration. Toute
          correction passe par une validation humaine préalable.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <Constats />
      </Suspense>
    </main>
  );
}
