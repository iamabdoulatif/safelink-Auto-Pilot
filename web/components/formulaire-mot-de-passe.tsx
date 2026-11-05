"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Changement du mot de passe depuis le profil, avec le mot de passe actuel.
export function FormulaireMotDePasse() {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    if (nouveau !== confirmation) {
      setErreur("Les deux nouveaux mots de passe sont différents.");
      return;
    }
    setOccupe(true);
    try {
      const reponse = await fetch("/api/profil/mot-de-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motDePasseActuel: actuel,
          nouveauMotDePasse: nouveau,
        }),
      });
      const corps = (await reponse.json()) as { error?: string };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Changement impossible.");
        return;
      }
      setActuel("");
      setNouveau("");
      setConfirmation("");
      setMessage("Mot de passe changé. Les autres sessions sont fermées.");
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      {erreur ? (
        <Alert variant="destructive">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actuel">Mot de passe actuel</Label>
        <Input
          id="actuel"
          type="password"
          autoComplete="current-password"
          value={actuel}
          onChange={(e) => setActuel(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nouveau">Nouveau (12 caractères minimum)</Label>
          <Input
            id="nouveau"
            type="password"
            autoComplete="new-password"
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            required
            minLength={12}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmation">Confirmer</Label>
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
      </div>
      <div className="pt-1">
        <Button type="submit" disabled={occupe}>
          {occupe ? "Enregistrement…" : "Changer le mot de passe"}
        </Button>
      </div>
    </form>
  );
}
