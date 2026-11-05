"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Demande du lien de reinitialisation. Le message reste identique que le
// compte existe ou non.
export default function PageMotDePasseOublie() {
  const [courriel, setCourriel] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setOccupe(true);
    try {
      const reponse = await fetch("/api/auth/mot-de-passe-oublie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courriel }),
      });
      if (!reponse.ok) throw new Error("refus");
      setEnvoye(true);
    } catch {
      setErreur("Demande impossible : vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Le lien est envoyé sur le Telegram privé configuré pour votre
            compte. Il reste valable 30 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {envoye ? (
            <Alert>
              <AlertDescription>
                Si ce compte existe et qu&apos;un Telegram privé est configuré,
                le lien vient d&apos;être envoyé. Une nouvelle demande est
                possible toutes les 2 minutes.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={envoyer} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="courriel">Courriel du compte</Label>
                <Input
                  id="courriel"
                  type="email"
                  autoComplete="email"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                  required
                />
              </div>
              {erreur ? <p role="alert">{erreur}</p> : null}
              <Button type="submit" disabled={occupe}>
                {occupe ? "Envoi…" : "Recevoir le lien"}
              </Button>
            </form>
          )}
          <Button variant="ghost" asChild>
            <Link href="/connexion">Revenir à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
