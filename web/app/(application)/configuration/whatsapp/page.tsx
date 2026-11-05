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

// Page « Configuration WhatsApp » : URL de l'adaptateur (webhook),
// destinataire, secret eventuel chiffre, activation. Envoi du PDF et
// du resume textuel via le workflow n8n. Jamais de secret journalise.
type Config = {
  webhookUrl: string;
  destinataireDefaut: string;
  secretConfigure: boolean;
  actif: boolean;
  statutConnexion: string;
  dernierTestLe: string | null;
} | null;

function promesseConfig(): Promise<{ data?: Config }> {
  return fetch("/api/configuration/whatsapp", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Config }>)
    .catch(() => ({}));
}

function Contenu({ initiale }: { initiale: Promise<{ data?: Config }> }) {
  const resolue = use(initiale);
  const [webhookUrl, setWebhookUrl] = useState(
    resolue.data?.webhookUrl ?? "");
  const [secret, setSecret] = useState("");
  const [destinataire, setDestinataire] = useState(
    resolue.data?.destinataireDefaut ?? "");
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
      const r = await fetch("/api/configuration/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          secret,
          destinataire,
          actif,
        }),
      });
      const j = (await r.json()) as { data?: Config; error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'enregistrement.");
        return;
      }
      setSecret("");
      setActuelle(j.data ?? null);
      setMessage("Configuration WhatsApp enregistrée et testée.");
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
          <CardTitle>Adaptateur WhatsApp</CardTitle>
          <CardDescription>
            Le PDF et un résumé textuel partent via cet adaptateur.
            Le secret éventuel est chiffré et jamais réaffiché.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="url">URL du webhook</Label>
            <Input
              id="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://adaptateur.exemple/hook"
              inputMode="url"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest">Destinataire par défaut</Label>
              <Input
                id="dest"
                value={destinataire}
                onChange={(e) => setDestinataire(e.target.value)}
                maxLength={128}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secret">Secret (optionnel)</Label>
              <Input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="new-password"
                placeholder="Vide = inchangé"
              />
            </div>
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
            <p className="text-muted-foreground">{actuelle.webhookUrl}</p>
            <p className="text-muted-foreground">
              Destinataire : {actuelle.destinataireDefaut || "—"} · secret :{" "}
              {actuelle.secretConfigure ? "configuré" : "absent"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ConfigurationWhatsApp() {
  const [initiale] = useState(promesseConfig);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuration WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Un adaptateur par espace. Les mots de passe des tickets ne
          transitent jamais dans une URL.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiale={initiale} />
      </Suspense>
    </main>
  );
}
