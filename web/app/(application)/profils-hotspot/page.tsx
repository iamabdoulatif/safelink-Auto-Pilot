"use client";

import { Suspense, use, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

// Page « Profils Hotspot » : liste les profils disponibles sur le routeur
// (/ip/hotspot/user/profile, lecture seule). Le mot de passe de lecture est
// dechiffre cote serveur uniquement.
type Config = { id: number; nom: string };
type Profil = { nom: string; serveur: string | null };

function promesseConfigs(): Promise<{ data?: Config[] }> {
  return fetch("/api/connexions-mikhmon", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Config[] }>)
    .catch(() => ({}));
}

function Contenu({ initiales }: { initiales: Promise<{ data?: Config[] }> }) {
  const resolues = use(initiales);
  const configs = resolues.data ?? [];
  const [configId, setConfigId] = useState("");
  const [profils, setProfils] = useState<Profil[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function charger(id: string) {
    setConfigId(id);
    setProfils(null);
    setErreur(null);
    if (!id) return;
    setOccupe(true);
    try {
      const r = await fetch("/api/routeurs-config/" + id + "/profils", {
        cache: "no-store",
      });
      const j = (await r.json()) as { data?: Profil[]; error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Lecture impossible.");
        return;
      }
      setProfils(j.data ?? []);
    } catch {
      setErreur("Requête impossible : vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur && (
        <Alert variant="destructive">
          <AlertTitle>Échec</AlertTitle>
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Routeur à inspecter</CardTitle>
          <CardDescription>
            Les profils sont lus en lecture seule sur le routeur choisi.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="config">Configuration</Label>
            <select
              id="config"
              value={configId}
              onChange={(e) => void charger(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
            >
              <option value="">— Choisir —</option>
              {configs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Button
              type="button"
              disabled={occupe || !configId}
              onClick={() => void charger(configId)}
            >
              Lister les profils
            </Button>
          </div>
        </CardContent>
      </Card>
      {profils && (
        <Card>
          <CardHeader>
            <CardTitle>Profils Hotspot ({profils.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {profils.map((p) => (
              <div key={p.nom} className="rounded-lg border p-2.5">
                <p className="font-medium">{p.nom}</p>
                {p.serveur && (
                  <p className="text-muted-foreground">
                    Adresse : {p.serveur}
                  </p>
                )}
              </div>
            ))}
            {profils.length === 0 && (
              <p className="text-muted-foreground">
                Aucun profil sur ce routeur.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProfilsHotspot() {
  const [initiales] = useState(promesseConfigs);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Profils Hotspot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Durée, débit et clients simultanés par profil : la génération de
          tickets exige un profil explicite.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Contenu initiales={initiales} />
      </Suspense>
    </main>
  );
}
