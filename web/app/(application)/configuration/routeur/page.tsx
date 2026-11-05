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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Formulaire « Configuration du routeur » : les mots de passe ne sont
// jamais réaffichés (champs toujours vides) ni journalisés. La liste
// initiale arrive via « use » (pas de useEffect) sous Suspense.
type ConfigMasquee = {
  id: number;
  nom: string;
  variante_mikhmon: string;
  url_mikhmon: string;
  identifiant_mikhmon: string;
  mot_de_passe_mikhmon: string;
  adresse_routeros: string;
  utilisateur_lecture: string;
  utilisateur_correction: string;
  mot_de_passe_correction: string;
};

const VIDE = {
  nom: "",
  variante_mikhmon: "v3",
  url_mikhmon: "",
  identifiant_mikhmon: "",
  mot_de_passe_mikhmon: "",
  adresse_routeros: "",
  utilisateur_lecture: "app-audit",
  mot_de_passe_lecture: "",
  utilisateur_correction: "app-fix",
  mot_de_passe_correction: "",
};

function promesseConfigs(): Promise<{ data?: ConfigMasquee[] }> {
  return fetch("/api/configuration/routeur", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: ConfigMasquee[] }>)
    .catch(() => ({}));
}

function Contenu({ initiales }: { initiales: Promise<{ data?: ConfigMasquee[] }> }) {
  const resolues = use(initiales);
  const [formulaire, setFormulaire] = useState(VIDE);
  const [configs, setConfigs] = useState<ConfigMasquee[]>(
    resolues.data ?? [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  function changer(cle: keyof typeof VIDE) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setFormulaire((f) => ({ ...f, [cle]: e.target.value }));
  }

  async function envoyer(url: string, enregistrer: boolean) {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulaire),
      });
      const j = (await r.json()) as {
        data?: ConfigMasquee | { routeur_ok: boolean; mikhmon_ok: boolean };
        error?: string;
      };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'opération.");
        return;
      }
      if (enregistrer) {
        // Les secrets ne restent jamais dans le formulaire après envoi.
        setFormulaire((f) => ({
          ...f,
          mot_de_passe_mikhmon: "",
          mot_de_passe_lecture: "",
          mot_de_passe_correction: "",
        }));
        const c = j.data as ConfigMasquee;
        setConfigs((ancien) => [
          c,
          ...ancien.filter((x) => x.id !== c.id || x.nom !== c.nom),
        ]);
        setMessage("Configuration enregistrée.");
      } else {
        setMessage("Connexion réussie : routeur et Mikhmon répondent.");
      }
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
          <CardTitle>Routeur et Mikhmon</CardTitle>
          <CardDescription>
            « Tester la connexion » vérifie sans enregistrer. « Enregistrer »
            reteste puis stocke en chiffré.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom du routeur</Label>
            <Input
              id="nom"
              value={formulaire.nom}
              onChange={changer("nom")}
              placeholder="Site A — salle serveur"
              maxLength={100}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variante">Variante Mikhmon</Label>
              <select
                id="variante"
                value={formulaire.variante_mikhmon}
                onChange={changer("variante_mikhmon")}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="v3">V3</option>
                <option value="sf-v1">SF v1</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="url-mikhmon">URL Mikhmon</Label>
              <Input
                id="url-mikhmon"
                value={formulaire.url_mikhmon}
                onChange={changer("url_mikhmon")}
                placeholder="http://192.168.88.1/mikhmon"
                inputMode="url"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="id-mikhmon">Identifiant Mikhmon</Label>
              <Input
                id="id-mikhmon"
                value={formulaire.identifiant_mikhmon}
                onChange={changer("identifiant_mikhmon")}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mdp-mikhmon">Mot de passe Mikhmon</Label>
              <Input
                id="mdp-mikhmon"
                type="password"
                value={formulaire.mot_de_passe_mikhmon}
                onChange={changer("mot_de_passe_mikhmon")}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adresse-ros">Adresse RouterOS</Label>
            <Input
              id="adresse-ros"
              value={formulaire.adresse_routeros}
              onChange={changer("adresse_routeros")}
              placeholder="https://192.168.88.1"
              inputMode="url"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-lecture">
                Utilisateur RouterOS (lecture seule)
              </Label>
              <Input
                id="user-lecture"
                value={formulaire.utilisateur_lecture}
                onChange={changer("utilisateur_lecture")}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-correction">
                Utilisateur RouterOS (correction)
              </Label>
              <Input
                id="user-correction"
                value={formulaire.utilisateur_correction}
                onChange={changer("utilisateur_correction")}
                autoComplete="username"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mdp-lecture">
              Mot de passe RouterOS (lecture seule)
            </Label>
            <Input
              id="mdp-lecture"
              type="password"
              value={formulaire.mot_de_passe_lecture}
              onChange={changer("mot_de_passe_lecture")}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mdp-correction">
              Mot de passe RouterOS (correction)
            </Label>
            <Input
              id="mdp-correction"
              type="password"
              value={formulaire.mot_de_passe_correction}
              onChange={changer("mot_de_passe_correction")}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={occupe}
              onClick={() =>
                void envoyer("/api/configuration/routeur/tester", false)
              }
            >
              Tester la connexion
            </Button>
            <Button
              type="button"
              disabled={occupe}
              onClick={() => void envoyer("/api/configuration/routeur", true)}
            >
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {configs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Routeurs enregistrés</CardTitle>
            <CardDescription>
              Secrets masqués : seul « configuré » s&apos;affiche, jamais la
              valeur.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {configs.map((c) => (
              <div key={c.id} className="rounded-lg border p-2.5">
                <p className="font-medium">
                  {c.nom} · Mikhmon {c.variante_mikhmon}
                </p>
                <p className="text-muted-foreground">
                  {c.url_mikhmon} · {c.identifiant_mikhmon} · mot de passe{" "}
                  {c.mot_de_passe_mikhmon}
                </p>
                <p className="text-muted-foreground">
                  {c.adresse_routeros} · lecture {c.utilisateur_lecture} ·
                  correction {c.utilisateur_correction} · mot de passe{" "}
                  {c.mot_de_passe_correction}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ConfigurationRouteur() {
  const [initiales] = useState(promesseConfigs);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration du routeur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identifiants Mikhmon et RouterOS de votre espace. Le mot de passe
          initial Mikhmon (mikhmon / 1234) doit être changé avant
          l&apos;enregistrement. Les secrets sont chiffrés côté serveur.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiales={initiales} />
      </Suspense>
    </main>
  );
}
