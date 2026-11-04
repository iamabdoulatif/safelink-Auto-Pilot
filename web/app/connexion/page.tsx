"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Connexion / inscription : le serveur pose un cookie de session signe
// (HttpOnly). Le navigateur l'envoie seul ensuite : aucun identifiant
// dans les en-tetes ni le stockage local.
export default function PageConnexion() {
  const router = useRouter();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      const reponse = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courriel, motDePasse }),
      });
      const corps = (await reponse.json()) as { error?: string };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Échec.");
        return;
      }
      router.push("/");
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "connexion" ? "Connexion" : "Inscription"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={envoyer} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                type="email"
                autoComplete="email"
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mot-de-passe">Mot de passe (12 caractères minimum)</Label>
              <Input
                id="mot-de-passe"
                type="password"
                autoComplete={mode === "connexion" ? "current-password" : "new-password"}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                minLength={12}
              />
            </div>
            {erreur ? <p role="alert">{erreur}</p> : null}
            <Button type="submit" disabled={envoi}>
              {envoi ? "…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === "connexion" ? "inscription" : "connexion")}
            >
              {mode === "connexion" ? "Créer un compte" : "Déjà un compte ? Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
