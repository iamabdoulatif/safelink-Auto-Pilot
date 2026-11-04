"use client";

import { Suspense, use, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Page « Mes connexions Mikhmon » : installations Mikhmon de l'espace
// (nom, variante V3/SF v1, hôte, port, URL, rôle, identifiant, mot de
// passe, statut, date du dernier test). Les tests sont exécutés côté
// serveur. Les identifiants par défaut mikhmon / 1234 sont refusés avec
// avertissement : le changement est forcé avant enregistrement.
type Installation = {
  id: number;
  nom: string;
  variante: string;
  hote: string | null;
  port: number;
  url: string;
  role: string;
  identifiant: string;
  statutConnexion: string;
  dernierTestLe: string | null;
  changementRequis: boolean;
  actif: boolean;
};

const VIDE = {
  nom: "",
  variante: "v3",
  hote: "127.0.0.1",
  port: "8088",
  role: "Administrateur",
  identifiant: "mikhmon",
  mot_de_passe: "",
};

function promesseInstallations(): Promise<{ data?: Installation[] }> {
  return fetch("/api/connexions-mikhmon", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Installation[] }>)
    .catch(() => ({}));
}

function Pastille({ statut }: { statut: string }) {
  const variante =
    statut === "en-ligne"
      ? "secondary"
      : statut === "hors-ligne" || statut === "erreur"
        ? "destructive"
        : "outline";
  return <Badge variant={variante}>{statut}</Badge>;
}

function Contenu({ initiales }: { initiales: Promise<{ data?: Installation[] }> }) {
  const resolues = use(initiales);
  const [formulaire, setFormulaire] = useState(VIDE);
  const [installations, setInstallations] = useState<Installation[]>(
    resolues.data ?? [],
  );
  const [editionId, setEditionId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  function changer(cle: keyof typeof VIDE) {
    return (
      e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setFormulaire((f) => ({ ...f, [cle]: e.target.value }));
  }

  async function recharger() {
    try {
      const r = await fetch("/api/connexions-mikhmon", { cache: "no-store" });
      const j = (await r.json()) as { data?: Installation[] };
      if (j.data) setInstallations(j.data);
    } catch {
      // La liste reste telle quelle en cas d'échec réseau.
    }
  }

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    // En modification, le mot de passe n'est jamais pré-rempli : il
    // doit être saisi à nouveau avant l'envoi (PUT).
    if (editionId !== null && formulaire.mot_de_passe === "") {
      setErreur(
        "Mot de passe obligatoire pour modifier : saisissez à nouveau le mot de passe.",
      );
      return;
    }
    setOccupe(true);
    try {
      const url = editionId === null
        ? "/api/connexions-mikhmon"
        : "/api/connexions-mikhmon/" + editionId;
      const r = await fetch(url, {
        method: editionId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formulaire,
          port: Number(formulaire.port),
        }),
      });
      const j = (await r.json()) as {
        data?: Installation & { test?: string };
        error?: string;
      };
      if (!r.ok) {
        const brut = j.error ?? "Échec de l'enregistrement.";
        // En création, un nom déjà pris (contrainte UNIQUE tenant_id,
        // nom) guide vers le bouton Modifier au lieu du doublon.
        const estDoublon = brut.includes("existe déjà");
        setErreur(
          editionId === null && estDoublon
            ? "Cette connexion existe déjà. Cliquez sur Modifier dans la liste existante."
            : brut,
        );
        return;
      }
      setFormulaire(VIDE);
      setEditionId(null);
      setMessage(
        editionId !== null
          ? "Connexion Mikhmon modifiée."
          : j.data?.test
            ? "Enregistrée, mais test en échec : " + j.data.test
            : "Connexion enregistrée et en ligne.",
      );
      await recharger();
    } catch {
      setErreur("Requête impossible : vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  function modifier(c: Installation) {
    setEditionId(c.id);
    setErreur(null);
    setMessage(null);
    setFormulaire({
      nom: c.nom,
      variante: c.variante,
      hote: c.hote ?? "",
      port: String(c.port),
      role: c.role,
      identifiant: c.identifiant,
      mot_de_passe: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function tester(id: number) {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/connexions-mikhmon/" + id + "/tester", {
        method: "POST",
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Test en échec.");
      } else {
        setMessage("Connexion en ligne.");
      }
      await recharger();
    } catch {
      setErreur("Requête impossible : vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  async function desactiver(id: number) {
    if (!window.confirm("Désactiver cette connexion ?")) return;
    setOccupe(true);
    try {
      await fetch("/api/connexions-mikhmon/" + id, { method: "DELETE" });
      await recharger();
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>Avertissement initial</AlertTitle>
        <AlertDescription>
          Ne conservez jamais les identifiants par défaut mikhmon / 1234 :
          le champ mot de passe commence volontairement vide. Saisissez le
          mot de passe déjà modifié dans Mikhmon.
        </AlertDescription>
      </Alert>
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
          <CardTitle>
            {editionId === null
              ? "Nouvelle connexion Mikhmon"
              : "Modifier la connexion Mikhmon"}
          </CardTitle>
          <CardDescription>
            L&apos;URL est calculée depuis l&apos;hôte et le port saisis
            (testée côté serveur, jamais depuis le navigateur).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom de la connexion</Label>
              <Input
                id="nom"
                value={formulaire.nom}
                onChange={changer("nom")}
                placeholder="Site A — Mikhmon"
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variante">Variante Mikhmon</Label>
              <select
                id="variante"
                value={formulaire.variante}
                onChange={changer("variante")}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="v3">V3</option>
                <option value="sf-v1">SF v1</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hote">Hôte</Label>
              <Input
                id="hote"
                value={formulaire.hote}
                onChange={changer("hote")}
                placeholder="127.0.0.1"
                maxLength={253}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={formulaire.port}
                onChange={changer("port")}
                inputMode="numeric"
                placeholder="8088"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Rôle</Label>
            <select
              id="role"
              value={formulaire.role}
              onChange={changer("role")}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
            >
              <option value="Administrateur">Administrateur</option>
              <option value="Gerant">Gérant</option>
              <option value="Vendeur">Vendeur</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="identifiant">Identifiant</Label>
              <Input
                id="identifiant"
                value={formulaire.identifiant}
                onChange={changer("identifiant")}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mdp">Mot de passe</Label>
              <Input
                id="mdp"
                type="password"
                value={formulaire.mot_de_passe}
                onChange={changer("mot_de_passe")}
                autoComplete="new-password"
                placeholder="Mot de passe Mikhmon modifié"
              />
              {editionId !== null && (
                <p className="text-xs text-muted-foreground">
                  Saisissez à nouveau le mot de passe pour valider la
                  modification (jamais affiché).
                </p>
              )}
            </div>
          </div>
          <div className="pt-1">
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={occupe} onClick={() => void enregistrer()}>
                {editionId === null ? "Enregistrer" : "Enregistrer les modifications"}
              </Button>
              {editionId !== null && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={occupe}
                  onClick={() => {
                    setEditionId(null);
                    setFormulaire(VIDE);
                  }}
                >
                  Annuler la modification
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connexions enregistrées</CardTitle>
          <CardDescription>
            Mots de passe jamais affichés. Depuis n8n sous Docker macOS,
            l&apos;hôte local devient host.docker.internal (dérivé
            automatiquement, jamais codé en dur).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {installations.filter((i) => i.actif).map((c) => (
            <div key={c.id} className="rounded-lg border p-2.5">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {c.nom} · Mikhmon {c.variante} · {c.role}
                <Pastille statut={c.statutConnexion} />
                {c.changementRequis && (
                  <Badge variant="destructive">mot de passe à changer</Badge>
                )}
              </p>
              <p className="text-muted-foreground">
                {c.url} · {c.identifiant} · dernier test :{" "}
                {c.dernierTestLe
                  ? new Date(c.dernierTestLe).toLocaleString("fr-FR")
                  : "jamais"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={occupe}
                  onClick={() => void tester(c.id)}
                >
                  Tester
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={occupe}
                  onClick={() => modifier(c)}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={occupe}
                  onClick={() => void desactiver(c.id)}
                >
                  Désactiver
                </Button>
              </div>
            </div>
          ))}
          {installations.filter((i) => i.actif).length === 0 && (
            <p className="text-muted-foreground">
              Aucune connexion : ajoutez votre installation Mikhmon ci-dessus.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnexionsMikhmon() {
  const [initiales] = useState(promesseInstallations);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Mes connexions Mikhmon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Installations Mikhmon de votre espace. Mikhmon n&apos;a pas
          d&apos;API de génération : les tickets sont créés dans RouterOS et
          deviennent visibles dans Mikhmon.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiales={initiales} />
      </Suspense>
    </main>
  );
}
