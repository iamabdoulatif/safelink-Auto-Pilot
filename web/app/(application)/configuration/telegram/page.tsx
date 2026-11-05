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

// Page « Configuration Telegram » : bot central (Chat ID uniquement,
// le jeton vit dans l'environnement serveur) ou bot personnalisé
// (jeton vérifié via getMe, chiffré en base, masqué à l'écran).
type ConfigTelegram = {
  mode: string;
  chat_id: string;
  jeton: string;
  nom_bot: string | null;
  bot_verifie: boolean;
} | null;

function promesseConfig(): Promise<{ data?: ConfigTelegram }> {
  return fetch("/api/configuration/telegram", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: ConfigTelegram }>)
    .catch(() => ({}));
}

function Contenu({ initiale }: { initiale: Promise<{ data?: ConfigTelegram }> }) {
  const resolue = use(initiale);
  const [mode, setMode] = useState(resolue.data?.mode ?? "central");
  const [chatId, setChatId] = useState(resolue.data?.chat_id ?? "");
  const [jeton, setJeton] = useState("");
  const [nomBot, setNomBot] = useState(resolue.data?.nom_bot ?? "");
  const [actuelle, setActuelle] = useState<ConfigTelegram>(
    resolue.data ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/configuration/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          chat_id: chatId,
          jeton,
          nom_bot: nomBot,
        }),
      });
      const j = (await r.json()) as {
        data?: ConfigTelegram;
        error?: string;
      };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'enregistrement.");
        return;
      }
      // Le jeton ne reste jamais dans le formulaire après envoi.
      setJeton("");
      setActuelle(j.data ?? null);
      setMessage(
        mode === "central"
          ? "Bot central configuré."
          : "Bot personnalisé vérifié et enregistré.",
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
          <CardTitle>Bot de livraison</CardTitle>
          <CardDescription>
            Une seule configuration par espace : l&apos;enregistrement remplace
            la précédente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Mode</legend>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm">
              <input
                type="radio"
                name="mode"
                value="central"
                checked={mode === "central"}
                onChange={() => setMode("central")}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Bot central</span>
                <span className="block text-muted-foreground">
                  Seul le Chat ID est demandé. Le jeton reste sur le serveur.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm">
              <input
                type="radio"
                name="mode"
                value="personnalise"
                checked={mode === "personnalise"}
                onChange={() => setMode("personnalise")}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Bot personnalisé</span>
                <span className="block text-muted-foreground">
                  Votre jeton (vérifié via getMe), votre Chat ID, le nom du
                  bot.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chat-id">Chat ID Telegram</Label>
            <Input
              id="chat-id"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="7917313059"
              inputMode="numeric"
            />
          </div>

          {mode === "personnalise" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="jeton">Jeton du bot</Label>
                <Input
                  id="jeton"
                  type="password"
                  value={jeton}
                  onChange={(e) => setJeton(e.target.value)}
                  placeholder="123456:ABC-DEF…"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nom-bot">Nom du bot (vérifié)</Label>
                <Input
                  id="nom-bot"
                  value={nomBot}
                  onChange={(e) => setNomBot(e.target.value)}
                  placeholder="@mon_bot"
                  maxLength={64}
                />
              </div>
            </>
          )}

          <div className="pt-1">
            <Button type="button" disabled={occupe} className="bg-signal text-white hover:bg-signal/90" onClick={() => void enregistrer()}>
              Enregistrer
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
              Mode :{" "}
              <Badge variant="secondary">
                {actuelle.mode === "central" ? "Bot central" : "Bot personnalisé"}
              </Badge>{" "}
              {actuelle.bot_verifie && <Badge>Vérifié</Badge>}
            </p>
            <p className="text-muted-foreground">Chat ID : {actuelle.chat_id}</p>
            <p className="text-muted-foreground">Jeton : {actuelle.jeton}</p>
            {actuelle.nom_bot && (
              <p className="text-muted-foreground">Bot : {actuelle.nom_bot}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ConfigurationTelegram() {
  const [initiale] = useState(promesseConfig);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration Telegram</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez le bot qui enverra les tickets. Le jeton d&apos;un bot
          personnalisé est vérifié auprès de Telegram, chiffré en base, et
          n&apos;apparaît ni à l&apos;écran ni dans les journaux.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiale={initiale} />
      </Suspense>
    </main>
  );
}
