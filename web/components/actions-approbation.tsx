"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Valide ou refuse une demande mise en pause par n8n. La decision est
// definitive : l'URL de reprise est consommee cote serveur.
export function ActionsApprobation({ id }: { id: number }) {
  const rafraichir = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function decider(decision: "approuver" | "refuser") {
    setOccupe(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/tickets/approbations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const corps = (await reponse.json()) as {
        data?: unknown; error?: string;
      };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Décision impossible.");
        return;
      }
      rafraichir.refresh();
    } catch {
      setErreur("Décision impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={occupe}
          onClick={() => void decider("approuver")}
        >
          <Check data-icon="inline-start" />
          Approuver
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={occupe}
          onClick={() => void decider("refuser")}
        >
          <X data-icon="inline-start" />
          Refuser
        </Button>
      </div>
      {erreur && (
        <Alert variant="destructive">
          <AlertTitle>Échec</AlertTitle>
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
