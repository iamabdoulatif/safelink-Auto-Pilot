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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Page « Configuration PrintNode » : clé API chiffrée, imprimante cible,
// format papier, activation. L'enregistrement teste réellement la clé
// (liste des imprimantes) : jamais d'impression automatique si non
// configuré et testé. Clé jamais réaffichée ni journalisée.
type Config = {
  cleConfiguree: boolean;
  printerId: number | null;
  nomImprimante: string | null;
  formatPapier: string;
  actif: boolean;
  statutConnexion: string;
  dernierTestLe: string | null;
  webhookConfigure: boolean;
  webhookId: number | null;
  webhookUrl: string;
} | null;

function promesseConfig(): Promise<{ data?: Config }> {
  return fetch("/api/configuration/printnode", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Config }>)
    .catch(() => ({}));
}

function Contenu({ initiale }: { initiale: Promise<{ data?: Config }> }) {
  const resolue = use(initiale);
  const [cle, setCle] = useState("");
  const [printerId, setPrinterId] = useState(
    resolue.data?.printerId ? String(resolue.data.printerId) : "",
  );
  const [nom, setNom] = useState(resolue.data?.nomImprimante ?? "");
  const [format, setFormat] = useState(
    resolue.data?.formatPapier ?? "A4");
  const [actif, setActif] = useState(resolue.data?.actif ?? true);
  const [actuelle, setActuelle] = useState<Config>(resolue.data ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/configuration/printnode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cle_api: cle,
          printer_id: Number(printerId),
          nom_imprimante: nom,
          format_papier: format,
          actif,
        }),
      });
      const j = (await r.json()) as { data?: Config; error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'enregistrement.");
        return;
      }
      setCle("");
      setActuelle(j.data ?? null);
      setMessage(
        j.data?.webhookConfigure
          ? "PrintNode configuré, imprimante vérifiée et webhook créé."
          : "PrintNode configuré et imprimante vérifiée.",
      );
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
          <CardTitle>Imprimante PrintNode</CardTitle>
          <CardDescription>
            Le PDF est envoyé avec printerId, titre du lot, profil et
            quantité. La clé est chiffrée et testée réellement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cle">Clé API PrintNode</Label>
            <Input
              id="cle"
              type="password"
              value={cle}
              onChange={(e) => setCle(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pid">Identifiant de l&apos;imprimante</Label>
              <Input
                id="pid"
                value={printerId}
                onChange={(e) => setPrinterId(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom de l&apos;imprimante (optionnel)</Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                maxLength={128}
                placeholder="Renseigné par le test sinon"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="format">Format papier</Label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
            >
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={actif}
              onChange={(e) => setActif(e.target.checked)}
            />
            <span>Activation</span>
          </label>
          <div className="pt-1">
            <Button type="button" disabled={occupe} onClick={() => void enregistrer()}>
              Enregistrer et tester
            </Button>
          </div>
        </CardContent>
      </Card>
      {actuelle && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration actuelle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>
              <Badge variant="secondary">{actuelle.statutConnexion}</Badge>{" "}
              {actuelle.actif ? (
                <Badge>activé</Badge>
              ) : (
                <Badge variant="outline">désactivé</Badge>
              )}
            </p>
            <p className="text-muted-foreground">
              Imprimante : {actuelle.nomImprimante ?? "—"} (
              {actuelle.printerId ?? "—"}) · format {actuelle.formatPapier}
            </p>
            <p className="text-muted-foreground">
              Clé : {actuelle.cleConfiguree ? "configurée" : "absente"}
            </p>
            <p className="text-muted-foreground">
              Webhook (états d&apos;impression) :{" "}
              {actuelle.webhookConfigure ? (
                <Badge>configuré n° {actuelle.webhookId}</Badge>
              ) : (
                <Badge variant="outline">non configuré</Badge>
              )}
            </p>
            {actuelle.webhookUrl && (
              <p className="break-all text-xs text-muted-foreground">
                URL appelée par PrintNode : {actuelle.webhookUrl}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Tutoriel — impression automatique</CardTitle>
          <CardDescription>
            Le PC relié à l&apos;imprimante doit faire tourner le client
            PrintNode. Sans lui, aucune impression ne part.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Crée un compte sur{" "}
              <a
                className="underline"
                href="https://www.printnode.com"
                target="_blank"
                rel="noreferrer"
              >
                printnode.com
              </a>
              , puis une clé API dans{" "}
              <a
                className="underline"
                href="https://app.printnode.com/apikeys"
                target="_blank"
                rel="noreferrer"
              >
                API Keys
              </a>
              .
            </li>
            <li>
              Sur le PC de l&apos;imprimante, télécharge et installe le
              client :{" "}
              <a
                className="underline"
                href="https://www.printnode.com/en/download"
                target="_blank"
                rel="noreferrer"
              >
                page de téléchargement PrintNode
              </a>
              . <strong>Windows</strong> : lance l&apos;installeur, le
              client démarre avec Windows. <strong>macOS</strong> : ouvre
              le fichier téléchargé, glisse PrintNode dans Applications,
              puis lance-le (autorise-le si macOS le demande).
            </li>
            <li>
              Connecte-toi dans le client avec ton compte PrintNode,
              branche et allume l&apos;imprimante : elle apparaît dans le
              client et dans PrintNode (menu Printers), avec son
              identifiant numérique.
            </li>
            <li>
              Reviens ici : colle la clé API, saisis l&apos;identifiant de
              l&apos;imprimante, choisis le format papier, laisse
              l&apos;activation cochée, puis « Enregistrer et tester ».
              L&apos;application vérifie l&apos;imprimante et crée le
              webhook automatiquement.
            </li>
            <li>
              Génère ensuite des tickets normalement : le PDF part tout
              seul vers l&apos;imprimante. Le PC doit rester allumé, le
              client PrintNode ouvert et l&apos;imprimante en ligne.
            </li>
          </ol>
          <p className="text-muted-foreground">
            En production, l&apos;application doit être joignable en
            https public (APP_URL) : PrintNode est un service en ligne,
            il ne peut pas appeler un poste en localhost. Dépannage et
            détails : fichier docs/tutoriel-printnode.md du projet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConfigurationPrintNode() {
  const [initiale] = useState(promesseConfig);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuration PrintNode</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sans configuration testée, aucune impression automatique ne part.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiale={initiale} />
      </Suspense>
    </main>
  );
}
