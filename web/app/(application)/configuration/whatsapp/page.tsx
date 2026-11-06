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
// Plus bas : les zones Wi-Fi (une par routeur) avec localisation,
// commune et numéros admin / gérant / vendeurs qui reçoivent le PDF.
type Zone = {
  routerConnectionId: number;
  routeurNom: string;
  varianteMikhmon: string;
  localisation: string;
  commune: string;
  numeroAdmin: string;
  numeroGerant: string;
  numerosVendeurs: string[];
  rapportActif: boolean;
  rapportCanal: string;
  rapportPlanification: string;
  rapportDebut: string;
  rapportFin: string;
  rapportDateEnvoi: string;
};

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

function promesseZones(): Promise<Zone[]> {
  return fetch("/api/configuration/whatsapp/zones", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: { zones: Zone[] } }>)
    .then((j) => j.data?.zones ?? [])
    .catch(() => []);
}

// Fiche d'une zone Wi-Fi : localisation, commune et numéros
// WhatsApp. Enregistrée par un admin ; ces numéros reçoivent le PDF.
function FicheZone({ zoneInitiale }: { zoneInitiale: Zone }) {
  const [localisation, setLocalisation] = useState(zoneInitiale.localisation);
  const [commune, setCommune] = useState(zoneInitiale.commune);
  const [numeroAdmin, setNumeroAdmin] = useState(zoneInitiale.numeroAdmin);
  const [numeroGerant, setNumeroGerant] = useState(zoneInitiale.numeroGerant);
  const [vendeurs, setVendeurs] = useState(zoneInitiale.numerosVendeurs.join("\n"));
  const [rapportActif, setRapportActif] = useState(zoneInitiale.rapportActif);
  const [rapportCanal, setRapportCanal] = useState(zoneInitiale.rapportCanal || "whatsapp");
  const [rapportPlanification, setRapportPlanification] = useState(zoneInitiale.rapportPlanification || "decade");
  const [rapportDebut, setRapportDebut] = useState(zoneInitiale.rapportDebut);
  const [rapportFin, setRapportFin] = useState(zoneInitiale.rapportFin);
  const [rapportDateEnvoi, setRapportDateEnvoi] = useState(zoneInitiale.rapportDateEnvoi);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const renseignee = Boolean(
    zoneInitiale.numeroAdmin || zoneInitiale.numeroGerant
    || zoneInitiale.numerosVendeurs.length > 0);

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/configuration/whatsapp/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerConnectionId: zoneInitiale.routerConnectionId,
          localisation,
          commune,
          numeroAdmin,
          numeroGerant,
          numerosVendeurs: vendeurs.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean),
          rapportActif, rapportCanal, rapportPlanification,
          rapportDebut, rapportFin, rapportDateEnvoi,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage("Zone enregistrée : ces numéros recevront les tickets sur WhatsApp.");
    } catch {
      setErreur("Requête impossible : vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {zoneInitiale.routeurNom}
          <Badge variant="outline">{zoneInitiale.varianteMikhmon === "sf-v1" ? "Mikhmon SF v1" : "Mikhmon V3"}</Badge>
          {renseignee
            ? <Badge>destinataires renseignés</Badge>
            : <Badge variant="secondary">à renseigner</Badge>}
        </CardTitle>
        <CardDescription>
          Où se trouve la zone, et qui reçoit les tickets générés sur ce routeur.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {erreur && (
          <Alert variant="destructive">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`loc-${zoneInitiale.routerConnectionId}`}>Localisation du Wi-Fi zone</Label>
            <Input
              id={`loc-${zoneInitiale.routerConnectionId}`}
              value={localisation}
              onChange={(e) => setLocalisation(e.target.value)}
              placeholder="Ex. Marché central, box 12"
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`com-${zoneInitiale.routerConnectionId}`}>Commune</Label>
            <Input
              id={`com-${zoneInitiale.routerConnectionId}`}
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              placeholder="Ex. Ouagadougou"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`adm-${zoneInitiale.routerConnectionId}`}>Numéro WhatsApp — Admin</Label>
            <Input
              id={`adm-${zoneInitiale.routerConnectionId}`}
              value={numeroAdmin}
              onChange={(e) => setNumeroAdmin(e.target.value)}
              placeholder="+226 70 00 00 00"
              inputMode="tel"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ger-${zoneInitiale.routerConnectionId}`}>Numéro WhatsApp — Gérant</Label>
            <Input
              id={`ger-${zoneInitiale.routerConnectionId}`}
              value={numeroGerant}
              onChange={(e) => setNumeroGerant(e.target.value)}
              placeholder="+226 70 00 00 00"
              inputMode="tel"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ven-${zoneInitiale.routerConnectionId}`}>Numéros WhatsApp — Vendeurs (un par ligne, 5 maximum)</Label>
          <textarea
            id={`ven-${zoneInitiale.routerConnectionId}`}
            className="min-h-20 rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={vendeurs}
            onChange={(e) => setVendeurs(e.target.value)}
            placeholder={"+226 70 00 00 00\n+226 76 00 00 00"}
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={rapportActif} onChange={(e) => setRapportActif(e.target.checked)} />
            <span>Envoyer le rapport des ventes de cette zone</span>
          </label>
          {rapportActif && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`canal-rapport-${zoneInitiale.routerConnectionId}`}>Canal du rapport</Label>
                <select id={`canal-rapport-${zoneInitiale.routerConnectionId}`} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring" value={rapportCanal} onChange={(e) => setRapportCanal(e.target.value)}>
                  <option value="whatsapp">WhatsApp (admin, gérant, vendeurs)</option>
                  <option value="telegram">Telegram (chat de l'espace)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`cycle-rapport-${zoneInitiale.routerConnectionId}`}>Cycle de calcul (de 00h à 00h)</Label>
                <select id={`cycle-rapport-${zoneInitiale.routerConnectionId}`} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring" value={rapportPlanification} onChange={(e) => setRapportPlanification(e.target.value)}>
                  <option value="decade">Décade : 1er-10, 11-20, 21-fin du mois</option>
                  <option value="hebdomadaire">Hebdomadaire : lundi à lundi</option>
                  <option value="mensuel">Mensuel : 1er au 1er</option>
                  <option value="personnalise">Période personnalisée ci-dessous</option>
                </select>
              </div>
              {rapportPlanification === "personnalise" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`debut-rapport-${zoneInitiale.routerConnectionId}`}>Du</Label>
                    <Input id={`debut-rapport-${zoneInitiale.routerConnectionId}`} type="date" value={rapportDebut} onChange={(e) => setRapportDebut(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`fin-rapport-${zoneInitiale.routerConnectionId}`}>Au (inclus)</Label>
                    <Input id={`fin-rapport-${zoneInitiale.routerConnectionId}`} type="date" value={rapportFin} onChange={(e) => setRapportFin(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`envoi-rapport-${zoneInitiale.routerConnectionId}`}>Date d'envoi</Label>
                    <Input id={`envoi-rapport-${zoneInitiale.routerConnectionId}`} type="date" value={rapportDateEnvoi} onChange={(e) => setRapportDateEnvoi(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Le gérant et l'admin reçoivent le total et le détail par profil ;
            chaque vendeur reçoit le point de sa zone, sur le canal choisi.
          </p>
        </div>
        <div>
          <Button type="button" disabled={occupe} className="bg-signal text-white hover:bg-signal/90" onClick={() => void enregistrer()}>
            Enregistrer la zone
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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
            <Button type="button" disabled={occupe} className="bg-signal text-white hover:bg-signal/90" onClick={() => void enregistrer()}>
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

function Zones({ initiale }: { initiale: Promise<Zone[]> }) {
  const zones = use(initiale);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Zones Wi-Fi et destinataires</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Une fiche par routeur : localisation, commune, puis les numéros
          de l&apos;admin, du gérant et des vendeurs. À chaque génération,
          le PDF des tickets part aussi sur ces WhatsApp, en plus de Telegram.
        </p>
      </div>
      {zones.length === 0 ? (
        <Alert>
          <AlertTitle>Aucun routeur</AlertTitle>
          <AlertDescription>
            Configurez d&apos;abord un routeur : chaque routeur devient une zone Wi-Fi à renseigner ici.
          </AlertDescription>
        </Alert>
      ) : (
        zones.map((z) => <FicheZone key={z.routerConnectionId} zoneInitiale={z} />)
      )}
    </div>
  );
}

export default function ConfigurationWhatsApp() {
  const [initiale] = useState(promesseConfig);
  const [zonesInitiales] = useState(promesseZones);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Un adaptateur par espace. Les mots de passe des tickets ne
          transitent jamais dans une URL.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiale={initiale} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Zones initiale={zonesInitiales} />
      </Suspense>
    </main>
  );
}
