"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Page de deconnexion : un clic explicite, car un simple lien pourrait etre
// charge a l'avance par le navigateur et couper la session.
export default function PageDeconnexion() {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function deconnecter() {
    setErreur("");
    setOccupe(true);
    try {
      const reponse = await fetch("/api/auth/deconnexion", { method: "POST" });
      if (!reponse.ok) throw new Error("refus");
      router.push("/connexion");
      router.refresh();
    } catch {
      setErreur("Déconnexion impossible : vérifiez votre connexion.");
      setOccupe(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <Card>
        <CardHeader>
          <CardTitle>Déconnexion</CardTitle>
          <CardDescription>
            Vous devrez saisir à nouveau votre mot de passe pour revenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {erreur ? (
            <Alert variant="destructive">
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="button" disabled={occupe} onClick={() => void deconnecter()}>
            {occupe ? "Déconnexion…" : "Se déconnecter"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/profil">Revenir à mon profil</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
