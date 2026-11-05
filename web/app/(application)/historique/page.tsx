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

// Ligne d'historique : runs + lots, sans aucun secret.
type Ligne = {
  run_id: string;
  routeur_nom: string | null;
  profil: string;
  stock_avant: number | null;
  seuil: number | null;
  quantite_demandee: number;
  quantite_creee_run: number;
  quantite_creee_lot: number | null;
  canal_envoi: string;
  destinataire: string | null;
  statut: string;
  erreur: string | null;
  debut_le: string;
  fin_le: string | null;
};

async function Lignes() {
  await connection();
  const { tenantId } = await sessionPage();
  const { rows } = await db.query<Ligne>(
    `SELECT r.run_id, r.profil, r.stock_avant, r.seuil,
       r.quantite_demandee, r.quantite_creee AS quantite_creee_run,
       l.quantite_creee AS quantite_creee_lot, r.canal_envoi,
       COALESCE(r.destinataire, l.destinataire) AS destinataire,
       r.statut, r.erreur, r.created_at AS debut_le,
       r.termine_le AS fin_le,
       COALESCE(cr.nom, r.mikhmon_connection_id::text) AS routeur_nom
     FROM ticket_generation_runs r
     LEFT JOIN lots_tickets l
       ON l.cle_idempotence = r.run_id AND l.tenant_id = r.tenant_id
     LEFT JOIN configurations_routeurs cr
       ON cr.id = r.router_connection_id AND cr.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1
     ORDER BY r.created_at DESC LIMIT 100`,
    [tenantId],
  );
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="font-medium">Aucune génération pour l&apos;instant</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les générations manuelles et automatiques apparaîtront ici.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((l) => (
        <Card key={l.run_id} className="transition-colors hover:border-foreground/25">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="truncate text-base">
              {l.routeur_nom ?? "?"} · {l.profil}
            </CardTitle>
            {l.statut === "echoue" ? (
              <Badge variant="destructive">{l.statut}</Badge>
            ) : l.statut === "en_cours" || l.statut === "en_attente" ? (
              <Badge className="bg-signal text-white">{l.statut}</Badge>
            ) : (
              <Badge className="bg-accent text-accent-foreground">{l.statut}</Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              Demandés : {l.quantite_demandee} · créés :{" "}
              {l.quantite_creee_lot ?? l.quantite_creee_run} · stock avant :{" "}
              {l.stock_avant ?? "—"} · seuil : {l.seuil ?? "—"} · canal :{" "}
              {l.canal_envoi}
            </p>
            <p>
              Début : {new Date(l.debut_le).toLocaleString("fr-FR")} · fin :{" "}
              {l.fin_le
                ? new Date(l.fin_le).toLocaleString("fr-FR")
                : "—"}
              {l.destinataire ? " · vers " + l.destinataire : ""}
            </p>
            {l.erreur && (
              <p className="text-status-critique">Erreur : {l.erreur}</p>
            )}
            <p className="truncate">Run : {l.run_id}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Historique() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <EntetePage
        titre="Historique"
        description="Générations manuelles et automatiques de votre espace. Aucun secret n'y figure."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        <Lignes />
      </Suspense>
    </main>
  );
}
