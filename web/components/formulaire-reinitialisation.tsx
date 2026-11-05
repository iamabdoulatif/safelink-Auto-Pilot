"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Saisie du nouveau mot de passe depuis le lien recu sur Telegram.
export function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [termine, setTermine] = useState(false);
  const [occupe, setOccupe] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe sont différents.");
      return;
    }
    setOccupe(true);
    try {
      const reponse = await fetch("/api/auth/reinitialiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, motDePasse }),
      });
      const corps = (await reponse.json()) as { error?: string };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Réinitialisation impossible.");
        return;
      }
      setTermine(true);
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setOccupe(false);
    }
  }

  if (termine) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Mot de passe changé. Les anciennes sessions sont fermées.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="nouveau">Nouveau mot de passe (12 caractères minimum)</Label>
        <Input
          id="nouveau"
          type="password"
          autoComplete="new-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
          minLength={12}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
        <Input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
          minLength={12}
        />
      </div>
      {erreur ? <p role="alert">{erreur}</p> : null}
      <Button type="submit" disabled={occupe}>
        {occupe ? "Enregistrement…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
