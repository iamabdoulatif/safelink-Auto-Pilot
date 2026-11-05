import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { sessionPage } from "@/lib/session";
import { ActionsApprobation } from "@/components/actions-approbation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EntetePage } from "@/components/entete-page";

// Demande de generation mise en pause par n8n, sans secret ni mot de passe.
type Demande = {
  id: number;
  execution_id: string;
  created_at: string;
  profil: string | null;
  quantite: number | null;
  routeur: string | null;
};

// Liste les executions en attente de validation pour l'espace courant.
async function Demandes() {
  await connection();
  const { tenantId } = await sessionPage();
  const { rows } = await db.query<Demande>(
    `SELECT id, execution_id, created_at,
       charge_utile->>'profil' AS profil,
       NULLIF(charge_utile->>'quantite', '')::integer AS quantite,
       charge_utile->>'routeur' AS routeur
     FROM executions_n8n
     WHERE tenant_id = $1 AND statut = 'en_attente'
     ORDER BY created_at DESC`,
    [tenantId],
  );
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune demande en attente.
      </p>
    );
  }
  return (
    <ul className="grid gap-4">
      {rows.map((d) => (
        <li key={d.id}>
          <Card className="border-signal/40 transition-colors hover:border-signal">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Génération {d.profil ?? "—"}
                <Badge className="bg-signal text-white">En attente</Badge>
              </CardTitle>
              <CardDescription>
                Reçue le {new Date(d.created_at).toLocaleString("fr-FR")} —
                exécution {d.execution_id.slice(0, 8)}…
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="mb-4 grid gap-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Routeur :</dt>
                  <dd>{d.routeur ?? "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Quantité :</dt>
                  <dd>{d.quantite ?? "—"}</dd>
                </div>
              </dl>
              <ActionsApprobation id={d.id} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

// Un workflow n8n peut mettre une generation en pause et demander une
// validation humaine ici. Approuver reprend le workflow, refuser l'arrete.
export default function PageApprobations() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <EntetePage
        titre="Approbations"
        description="Les générations mises en pause par vos workflows attendent votre décision : approuver reprend l'envoi, refuser l'arrête."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <Demandes />
      </Suspense>
    </main>
  );
}
