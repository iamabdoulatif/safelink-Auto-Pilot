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

// Page « Réapprovisionnement automatique » : un abonnement par routeur
// et profil (seuil défaut 50, cible défaut 120, canal, activation).
// L'activation explicite vaut validation humaine prealable ; chaque
// generation reste journalisee (voir Historique). Tableau : derniere
// verification, stock, seuil, quantite prevue, prochaine verification,
// statut, derniere erreur, dernier lot.
type Config = { id: number; nom: string };

type Abonnement = {
  id: number;
  profil: string;
  seuil: number;
  quantite_cible: number;
  canal: string;
  destinataire: string | null;
  actif: boolean;
  derniere_verif_le: string | null;
  dernier_stock: number | null;
  derniere_erreur: string | null;
  configuration_routeur_id: number | null;
  routeur_nom: string | null;
  prochaine_verification: string | null;
  statut_run: string | null;
  dernier_lot: number | null;
  dernier_lot_le: string | null;
  erreur_run: string | null;
};

function promesseDonnees(): Promise<{
  abos?: Abonnement[];
  configs?: Config[];
}> {
  const abos = fetch("/api/tickets/abonnements", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Abonnement[] }>)
    .catch(() => ({} as { data?: Abonnement[] }))
    .then((j) => j.data ?? []);
  const configs = fetch("/api/connexions-mikhmon", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: Config[] }>)
    .catch(() => ({} as { data?: Config[] }))
    .then((j) => j.data ?? []);
  return Promise.all([abos, configs]).then(([a, c]) => ({
    abos: a,
    configs: c,
  }));
}

const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("fr-FR") : "—";

function Contenu({
  initiales,
}: {
  initiales: Promise<{ abos?: Abonnement[]; configs?: Config[] }>;
}) {
  const resolues = use(initiales);
  const [abonnements, setAbonnements] = useState<Abonnement[]>(
    resolues.abos ?? [],
  );
  const configs = resolues.configs ?? [];
  const [formulaire, setFormulaire] = useState({
    configurationId: "",
    profil: "",
    seuil: "50",
    cible: "120",
    canal: "telegram",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  function changer(cle: keyof typeof formulaire) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setFormulaire((f) => ({ ...f, [cle]: e.target.value }));
  }

  async function recharger() {
    try {
      const r = await fetch("/api/tickets/abonnements", {
        cache: "no-store",
      });
      const j = (await r.json()) as { data?: Abonnement[] };
      if (j.data) setAbonnements(j.data);
    } catch {
      // La liste reste telle quelle en cas d'échec réseau.
    }
  }

  async function activer(a: Abonnement, actif: boolean) {
    setOccupe(true);
    try {
      await fetch("/api/tickets/abonnements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuration_routeur_id: a.configuration_routeur_id,
          profil: a.profil,
          seuil: a.seuil,
          quantite_cible: a.quantite_cible,
          canal: a.canal,
          actif,
        }),
      });
      await recharger();
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrer() {
    setMessage(null);
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/tickets/abonnements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuration_routeur_id: formulaire.configurationId
            ? Number(formulaire.configurationId)
            : null,
          profil: formulaire.profil,
          seuil: Number(formulaire.seuil),
          quantite_cible: Number(formulaire.cible),
          canal: formulaire.canal,
          actif: true,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de l'enregistrement.");
        return;
      }
      setMessage(
        "Réapprovisionnement activé : cette activation vaut validation préalable.",
      );
      await recharger();
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
          <CardTitle>Nouvel abonnement</CardTitle>
          <CardDescription>
            Seuil par défaut 50 tickets neufs, cible par défaut 120.
            Stock neuf = même profil, actif, jamais utilisé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg">Routeur</Label>
              <select
                id="cfg"
                value={formulaire.configurationId}
                onChange={changer("configurationId")}
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profil">Profil Hotspot</Label>
              <Input
                id="profil"
                value={formulaire.profil}
                onChange={changer("profil")}
                maxLength={64}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seuil">Seuil (défaut 50)</Label>
              <Input
                id="seuil"
                value={formulaire.seuil}
                onChange={changer("seuil")}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cible">Quantité cible (défaut 120)</Label>
              <Input
                id="cible"
                value={formulaire.cible}
                onChange={changer("cible")}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canal">Canal</Label>
              <select
                id="canal"
                value={formulaire.canal}
                onChange={changer("canal")}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="printnode">PrintNode</option>
                <option value="pdf">PDF</option>
                <option value="interface">Interface</option>
              </select>
            </div>
          </div>
          <div className="pt-1">
            <Button
              type="button"
              disabled={occupe}
              className="bg-signal text-white hover:bg-signal/90"
              onClick={() => void enregistrer()}
            >
              Activer le réapprovisionnement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>État par routeur et profil</CardTitle>
          <CardDescription>
            Vérification toutes les 15 minutes (cron ou Schedule n8n).
            Prochaine vérification calculée depuis la dernière.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {abonnements.map((a) => (
            <div key={a.id} className="rounded-lg border p-2.5">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {a.routeur_nom ?? "?"} · {a.profil} ·
                {a.actif ? (
                  <Badge className="bg-accent text-accent-foreground">activé</Badge>
                ) : (
                  <Badge className="bg-signal text-white">en pause</Badge>
                )}
                {a.statut_run && (
                  <Badge
                    variant={
                      a.statut_run === "echoue" ? "destructive" : "secondary"
                    }
                  >
                    run {a.statut_run}
                  </Badge>
                )}
              </p>
              <p className="text-muted-foreground">
                Stock : {a.dernier_stock ?? "—"} · seuil : {a.seuil} ·
                cible : {a.quantite_cible} · canal : {a.canal}
              </p>
              <p className="text-muted-foreground">
                Dernière vérification : {date(a.derniere_verif_le)} ·
                prochaine : {date(a.prochaine_verification)}
              </p>
              <p className="text-muted-foreground">
                Dernier lot :{" "}
                {a.dernier_lot ?? "—"}
                {a.dernier_lot_le ? " (" + date(a.dernier_lot_le) + ")" : ""} ·
                erreur : {a.erreur_run ?? a.derniere_erreur ?? "—"}
              </p>
              <div className="mt-1.5">
                {a.actif ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={occupe}
                    onClick={() => void activer(a, false)}
                  >
                    Mettre en pause
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={occupe}
                    onClick={() => void activer(a, true)}
                  >
                    Réactiver
                  </Button>
                )}
              </div>
            </div>
          ))}
          {abonnements.length === 0 && (
            <p className="text-muted-foreground">
              Aucun abonnement : activez le réapprovisionnement ci-dessus.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Reapprovisionnement() {
  const [initiales] = useState(promesseDonnees);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Réapprovisionnement automatique
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sous le seuil, la ronde déclenche n8n (quantité configurée,
          anti-doublon par run, sans relance tant que le précédent
          n&apos;est pas terminé).
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenu initiales={initiales} />
      </Suspense>
    </main>
  );
}
