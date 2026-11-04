"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Affiche quand le segment / leve : base coupee, routeur injoignable.
// Aucun detail technique ici : le message exact reste dans les journaux serveur.
export default function Erreur({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Le parc ne répond pas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Impossible de charger les routeurs pour le moment. Vérifiez que la
            base de données tourne, puis réessayez.
          </p>
          <Button onClick={() => reset()}>Réessayer</Button>
        </CardContent>
      </Card>
    </main>
  );
}
