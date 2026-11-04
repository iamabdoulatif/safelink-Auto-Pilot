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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Page « Paramètres du compte » : valeurs proposees par defaut dans le
// formulaire de generation (profil, quantite, canal, connexions).
type Reglages = {
  profilDefaut: string | null;
  quantiteDefaut: number;
  canalDefaut: string;
  mikhmonConnectionId: number | null;
  routerConnectionId: number | null;
} | null;

type Config = { id: number; nom: string };

function promesseDonnees(): Promise<{
  reglages?: Reglages;
  configs?: Config[];
}> {
  const reglages = fetch("/api/parametres", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Reglages }>)
    .catch(() => ({} as { data?: Reglages }))
    .then((j) => j.data ?? null);
  const configs = fetch("/api/connexions-mikhmon", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Config[] }>)
    .catch(() => ({} as { data?: Config[] }))
    .then((j) => j.data ?? []);
  return Promise.all([reglages, configs]).then(([r, c]) => ({
    reglages: r,
    configs: c,
  }));
}

function Contenu({
  initiales,
}: {
  initiales: Promise<{ reglages?: Reglages; configs?: Config[] }>;
}) {
  const resolues = use(initiales);
  const configs = resolues.configs ?? [];
  const [profil, setProfil] = useState(
    resolues.reglages?.profilDefaut ?? "");
  const [quantite, setQuantite] = useState(
    String(resolues.reglages?.quantiteDefaut ?? 10));
  const [canal, setCanal] = useState(
    resolues.reglages?.canalDefaut ?? "interface");
  const [mikhmonId, setMikhmonId] = useState(
    resolues.reglages?.mikhmonConnectionId
      ? String(resolues.reglages.mikhmonConnectionId) : "");
  const [routeurId, setRouteurId] = useState(
    resolues.reglages?.routerConnectionId
      ? String(resolues.reglages.routerConnectionId) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/parametres", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profil_defaut: profil || null,
          quantite_defaut: Number(quantite),
          canal_defaut: canal,
          mikhmon_connection_id: mikhmonId ? Number(mikhmonId) : null,
          router_connection_id: routeurId ? Number(routeurId) : null,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'enregistrement.");
        return;
      }
      setMessage("Paramètres enregistrés.");
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
      {message && (
        <Alert>
          <AlertTitle>Succès</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Valeurs par défaut</CardTitle>
          <CardDescription>
            Proposées dans le formulaire de génération de tickets.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profil">Profil par défaut</Label>
              <Input
                id="profil"
                value={profil}
                onChange={(e) => setProfil(e.target.value)}
                maxLength={64}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantite">Quantité par défaut</Label>
              <Input
                id="quantite"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="canal">Canal par défaut</Label>
            <select
              id="canal"
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
            >
              <option value="interface">Interface</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="printnode">PrintNode</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mikhmon">Connexion Mikhmon</Label>
              <select
                id="mikhmon"
                value={mikhmonId}
                onChange={(e) => setMikhmonId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="">— Aucune —</option>
                {configs.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="routeur">Routeur</Label>
              <select
                id="routeur"
                value={routeurId}
                onChange={(e) => setRouteurId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="">— Aucun —</option>
                {configs.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-1">
            <Button type="button" disabled={occupe} onClick={() => void enregistrer()}>
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Parametres() {
  const [initiales] = useState(promesseDonnees);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres du compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Réglages de votre espace. Isolation stricte : un espace ne voit
          jamais les données d&apos;un autre.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiales={initiales} />
      </Suspense>
    </main>
  );
}
