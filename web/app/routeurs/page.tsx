"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Page « Mes routeurs » : section RouterOS SEPAREE de Mikhmon
// (adresse, utilisateur + mot de passe de lecture, utilisateur + mot de
// passe de correction, serveur Hotspot). Diagnostic = lecture seule,
// ecritures = compte de correction, apres validation humaine.
type Config = { id: number; nom: string };

type Connexion = {
  configurationId: number;
  nom: string;
  adresseRouterOS: string;
  utilisateurLecture: string;
  utilisateurCorrection: string;
  serveurHotspot: string | null;
  statutConnexion: string;
  dernierTestLe: string | null;
  correctionConfiguree: boolean;
};

function Contenu() {
  const router = useRouter();
  // Liste chargée uniquement côté client : le premier rendu (serveur et
  // client) est identique, ce qui évite toute erreur d'hydratation.
  const [configs, setConfigs] = useState<Config[]>([]);
  const [chargementConfigs, setChargementConfigs] = useState(true);
  const [configId, setConfigId] = useState("");
  const [connexion, setConnexion] = useState<Connexion | null>(null);
  const [formulaire, setFormulaire] = useState({
    adresse_routeros: "",
    utilisateur_lecture: "app-audit",
    mot_de_passe_lecture: "",
    utilisateur_correction: "app-fix",
    mot_de_passe_correction: "",
    serveur_hotspot: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch("/api/connexions-mikhmon", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) {
          router.replace("/connexion");
          return { data: [] };
        }
        return r.json() as Promise<{ data?: Config[] }>;
      })
      .then((j) => {
        if (annule) return;
        const liste = j.data ?? [];
        setConfigs(liste);
        if (liste.length === 1) setConfigId(String(liste[0].id));
      })
      .catch(() => {})
      .finally(() => {
        if (!annule) setChargementConfigs(false);
      });
    return () => {
      annule = true;
    };
  }, [router]);

  function changer(cle: keyof typeof formulaire) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormulaire((f) => ({ ...f, [cle]: e.target.value }));
  }

  async function charger(id: string) {
    setConfigId(id);
    setConnexion(null);
    if (!id) return;
    setOccupe(true);
    try {
      const r = await fetch("/api/routeurs-config/" + id, {
        cache: "no-store",
      });
      const j = (await r.json()) as { data?: Connexion; error?: string };
      if (j.data) {
        setConnexion(j.data);
        setFormulaire((f) => ({
          ...f,
          adresse_routeros: j.data?.adresseRouterOS ?? "",
          utilisateur_lecture: j.data?.utilisateurLecture ?? "app-audit",
          utilisateur_correction:
            j.data?.utilisateurCorrection ?? "app-fix",
          serveur_hotspot: j.data?.serveurHotspot ?? "",
        }));
      }
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/routeurs-config/" + configId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulaire),
      });
      const j = (await r.json()) as { data?: Connexion; error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'enregistrement.");
        return;
      }
      setFormulaire((f) => ({
        ...f,
        mot_de_passe_lecture: "",
        mot_de_passe_correction: "",
      }));
      if (j.data) setConnexion(j.data);
      setMessage("Section RouterOS enregistrée (secrets chiffrés).");
    } catch {
      setErreur("Requête impossible : vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  async function tester() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch(
        "/api/routeurs-config/" + configId + "/tester",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mot_de_passe_lecture: formulaire.mot_de_passe_lecture,
          }),
        },
      );
      const j = (await r.json()) as {
        data?: { version: string };
        error?: string;
      };
      if (!r.ok) {
        setErreur(j.error ?? "Test en échec.");
        return;
      }
      setMessage(
        "Routeur en ligne (version " + (j.data?.version ?? "?") + ").",
      );
      await charger(configId);
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
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Choisissez la connexion (partie Mikhmon), puis renseignez la
            section RouterOS. Identifiants distincts, jamais confondus.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="config">Configuration</Label>
            <select
              id="config"
              value={configId}
              disabled={chargementConfigs}
              onChange={(e) => void charger(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
            >
              <option value="">
                {chargementConfigs ? "Chargement…" : "— Choisir —"}
              </option>
              {configs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nom}
                </option>
              ))}
            </select>
            {!chargementConfigs && configs.length === 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
                <p className="text-muted-foreground">
                  Aucune connexion Mikhmon n&apos;est disponible. Créez d&apos;abord
                  une connexion Mikhmon pour pouvoir sélectionner ce routeur.
                </p>
                <Button asChild variant="outline" className="w-fit">
                  <Link href="/connexions-mikhmon">
                    Ajouter une connexion Mikhmon
                  </Link>
                </Button>
              </div>
            )}
          </div>
          {connexion && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{connexion.nom}</span>
              <Badge variant="secondary">{connexion.statutConnexion}</Badge>
              {connexion.correctionConfiguree && (
                <Badge>correction configurée</Badge>
              )}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adresse">URL ou adresse RouterOS</Label>
            <Input
              id="adresse"
              value={formulaire.adresse_routeros}
              onChange={changer("adresse_routeros")}
              placeholder="https://192.168.88.1"
              inputMode="url"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ulecture">Utilisateur (lecture seule)</Label>
              <Input
                id="ulecture"
                value={formulaire.utilisateur_lecture}
                onChange={changer("utilisateur_lecture")}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mlecture">Mot de passe (lecture seule)</Label>
              <Input
                id="mlecture"
                type="password"
                value={formulaire.mot_de_passe_lecture}
                onChange={changer("mot_de_passe_lecture")}
                autoComplete="new-password"
                placeholder="Vide = conserve le secret enregistré"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ucorr">Utilisateur (correction)</Label>
              <Input
                id="ucorr"
                value={formulaire.utilisateur_correction}
                onChange={changer("utilisateur_correction")}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mcorr">Mot de passe (correction)</Label>
              <Input
                id="mcorr"
                type="password"
                value={formulaire.mot_de_passe_correction}
                onChange={changer("mot_de_passe_correction")}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serveur">Serveur Hotspot</Label>
            <Input
              id="serveur"
              value={formulaire.serveur_hotspot}
              onChange={changer("serveur_hotspot")}
              placeholder="hotspot1"
              maxLength={100}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={occupe || !configId}
              onClick={() => void tester()}
            >
              Tester (lecture seule)
            </Button>
            <Button
              type="button"
              disabled={occupe || !configId}
              onClick={() => void enregistrer()}
            >
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Routeurs() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Mes routeurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le diagnostic utilise le compte lecture seule ; les écritures
          utilisent uniquement le compte de correction, après validation
          humaine.
        </p>
      </div>
      <Contenu />
    </main>
  );
}
