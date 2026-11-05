"use client";

import { Suspense, use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { SelecteurProfilsHotspot } from "@/components/selecteur-profils-hotspot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Page « Réapprovisionnement automatique » : chaque utilisateur configure
// ses seuils par routeur et profil, puis ACTIVE explicitement. Tant que
// l'option n'est pas activee, aucune generation automatique n'est possible.
type Regle = {
  id: number;
  utilisateur_id: string;
  router_connection_id: number;
  routeur_nom: string;
  profil: string;
  seuil: number;
  quantite_generation: number;
  quantite_cible: number;
  frequence_minutes: number;
  canal: string;
  destinataire: string;
  duree_limite: string | null;
  volume_limite_octets: number | null;
  actif: boolean;
  simulation_reussie: boolean;
  dernier_stock: number | null;
  derniere_erreur: string | null;
  blocages: string[];
};

type RouteurChoix = { id: number; nom: string };

const VIDE = {
  routerConnectionId: "",
  profil: "",
  seuil: "50",
  quantiteGeneration: "120",
  quantiteCible: "120",
  frequenceMinutes: "15",
  canal: "telechargement",
  destinataire: "",
  dureeLimite: "",
  volumeLimiteOctets: "",
};

function promesseDonnees(): Promise<{
  regles: Regle[];
  routeurs: RouteurChoix[];
}> {
  const regles = fetch("/api/reapprovisionnement", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: { regles: Regle[] } }>)
    .catch(() => ({} as { data?: { regles: Regle[] } }))
    .then((j) => j.data?.regles ?? []);
  const routeurs = fetch("/api/configuration/routeur", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: RouteurChoix[] }>)
    .catch(() => ({} as { data?: RouteurChoix[] }))
    .then((j) => j.data ?? []);
  return Promise.all([regles, routeurs]).then(([r, t]) => ({
    regles: r,
    routeurs: t,
  }));
}

function Contenu({
  initiales,
}: {
  initiales: Promise<{ regles: Regle[]; routeurs: RouteurChoix[] }>;
}) {
  const resolues = use(initiales);
  const [regles, setRegles] = useState<Regle[]>(resolues.regles);
  const [routeurs, setRouteurs] = useState<RouteurChoix[]>(resolues.routeurs);
  const [form, setForm] = useState(VIDE);
  const [regleEnModification, setRegleEnModification] = useState<number | null>(null);
  const [cible, setCible] = useState<Regle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function charger() {
    setErreur(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/reapprovisionnement", { cache: "no-store" })
          .then((r) => r.json()) as Promise<{ data?: { regles: Regle[] } }>,
        fetch("/api/configuration/routeur", { cache: "no-store" })
          .then((r) => r.json()) as Promise<{ data?: RouteurChoix[] }>,
      ]);
      setRegles(r1.data?.regles ?? []);
      setRouteurs(r2.data ?? []);
    } catch {
      setErreur("Chargement impossible.");
    }
  }

  function champ(nom: keyof typeof VIDE) {
    return {
      value: form[nom],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [nom]: e.target.value })),
    };
  }

  async function enregistrer() {
    setErreur(null);
    setMessage(null);
    setOccupe(true);
    try {
      const nombre = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const r = await fetch("/api/reapprovisionnement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerConnectionId: Number(form.routerConnectionId),
          profil: form.profil,
          seuil: nombre(form.seuil),
          quantiteGeneration: nombre(form.quantiteGeneration),
          quantiteCible: nombre(form.quantiteCible),
          frequenceMinutes: nombre(form.frequenceMinutes),
          canal: form.canal,
          destinataire: form.destinataire,
          dureeLimite: form.dureeLimite || undefined,
          volumeLimiteOctets: form.volumeLimiteOctets.trim() === ""
            ? undefined
            : Number(form.volumeLimiteOctets),
        }),
      });
      const corps = (await r.json()) as {
        data?: { blocages: string[] };
        error?: string;
      };
      if (!r.ok) {
        setErreur(corps.error ?? "Enregistrement impossible.");
      } else {
        setMessage(regleEnModification === null
          ? "Réglage enregistré. Activez-le après les vérifications."
          : "Réglage modifié avec succès.");
        setForm(VIDE);
        setRegleEnModification(null);
        await charger();
      }
    } catch {
      setErreur("Enregistrement impossible.");
    } finally {
      setOccupe(false);
    }
  }

  function modifier(regle: Regle) {
    setErreur(null);
    setMessage(null);
    setRegleEnModification(regle.id);
    setForm({
      routerConnectionId: String(regle.router_connection_id),
      profil: regle.profil,
      seuil: String(regle.seuil),
      quantiteGeneration: String(regle.quantite_generation),
      quantiteCible: String(regle.quantite_cible),
      frequenceMinutes: String(regle.frequence_minutes),
      canal: regle.canal,
      destinataire: regle.destinataire,
      dureeLimite: regle.duree_limite ?? "",
      volumeLimiteOctets: regle.volume_limite_octets === null
        ? ""
        : String(regle.volume_limite_octets),
    });
  }

  function annulerModification() {
    setRegleEnModification(null);
    setForm(VIDE);
    setErreur(null);
    setMessage(null);
  }

  async function changerActivation(regle: Regle, actif: boolean) {
    setErreur(null);
    setMessage(null);
    setCible(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/reapprovisionnement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regleId: regle.id, actif }),
      });
      const corps = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErreur(corps.error ?? "Mise à jour impossible.");
      } else {
        setMessage(actif ? "Réapprovisionnement activé." : "Mis en pause.");
        await charger();
      }
    } catch {
      setErreur("Mise à jour impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Réapprovisionnement automatique</h1>
      <Alert>
        <AlertTitle>Tickets créés sur RouterOS</AlertTitle>
        <AlertDescription>
          Les tickets sont créés sur RouterOS et deviennent visibles
          automatiquement dans Mikhmon. Un ticket neuf compte pour le profil
          choisi, actif et jamais utilisé. Après un réassort réussi, le
          système attend que le stock repasse au-dessus du seuil avant
          d&apos;armer un nouveau cycle.
        </AlertDescription>
      </Alert>
      {erreur && (
        <Alert>
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mes règles</CardTitle>
          <CardDescription>
            Une règle par routeur et profil. Seules les règles actives génèrent
            des tickets. Une règle en pause est d&apos;abord simulée
            automatiquement, sans créer de ticket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Routeur</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Seuil</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regles.map((regle) => (
                <TableRow key={regle.id}>
                  <TableCell>{regle.routeur_nom}</TableCell>
                  <TableCell>{regle.profil}</TableCell>
                  <TableCell>{regle.seuil}</TableCell>
                  <TableCell>{regle.quantite_generation}</TableCell>
                  <TableCell>{regle.canal}</TableCell>
                  <TableCell>
                    <Badge>{regle.actif ? "actif" : "en pause"}</Badge>
                    {regle.simulation_reussie && (
                      <Badge> simulation ok</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={occupe}
                        variant="outline"
                        onClick={() => modifier(regle)}
                      >
                        Modifier
                      </Button>
                      {regle.actif ? (
                        <Button
                          disabled={occupe}
                          onClick={() => void changerActivation(regle, false)}
                        >
                          Mettre en pause
                        </Button>
                      ) : (
                        <Button
                          disabled={occupe}
                          onClick={() => setCible(regle)}
                        >
                          Activer le réapprovisionnement automatique
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {regles.length === 0 && (
            <p className="pt-4 text-sm">Aucune règle pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {regleEnModification === null ? "Nouvelle règle" : "Modifier la règle"}
          </CardTitle>
          <CardDescription>
            Valeurs par défaut : seuil 50 tickets neufs, génération 120
            tickets, vérification toutes les 15 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="routeur">Routeur</Label>
            <select
              id="routeur"
              value={form.routerConnectionId}
              onChange={(e) => setForm((f) => ({
                ...f,
                routerConnectionId: e.target.value,
                profil: "",
              }))}
            >
              <option value="">Choisir…</option>
              {routeurs.map((r) => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="profil">Profil Hotspot</Label>
            <SelecteurProfilsHotspot
              id="profil"
              configurationId={form.routerConnectionId}
              value={form.profil}
              onChange={(profil) => setForm((f) => ({ ...f, profil }))}
            />
          </div>
          <div>
            <Label htmlFor="seuil">Seuil minimum</Label>
            <Input id="seuil" inputMode="numeric" {...champ("seuil")} />
          </div>
          <div>
            <Label htmlFor="quantite">Quantité de génération</Label>
            <Input id="quantite" inputMode="numeric"
              {...champ("quantiteGeneration")} />
          </div>
          <div>
            <Label htmlFor="cible">Quantité cible</Label>
            <Input id="cible" inputMode="numeric"
              {...champ("quantiteCible")} />
          </div>
          <div>
            <Label htmlFor="frequence">Fréquence (minutes)</Label>
            <Input id="frequence" inputMode="numeric"
              {...champ("frequenceMinutes")} />
          </div>
          <div>
            <Label htmlFor="canal">Canal de livraison</Label>
            <select id="canal" {...champ("canal")}>
              <option value="telechargement">Téléchargement PDF</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="printnode">PrintNode</option>
            </select>
          </div>
          <div>
            <Label htmlFor="destinataire">Destinataire</Label>
            <Input id="destinataire" {...champ("destinataire")} />
          </div>
          <div>
            <Label htmlFor="duree">Durée éventuelle (ex. 2h)</Label>
            <Input id="duree" {...champ("dureeLimite")} />
          </div>
          <div>
            <Label htmlFor="volume">Limite de volume (octets)</Label>
            <Input id="volume" inputMode="numeric"
              {...champ("volumeLimiteOctets")} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={occupe} onClick={() => void enregistrer()}>
              {regleEnModification === null
                ? "Enregistrer la règle"
                : "Enregistrer les modifications"}
            </Button>
            {regleEnModification !== null && (
              <Button
                disabled={occupe}
                variant="outline"
                onClick={annulerModification}
              >
                Annuler la modification
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={cible !== null} onOpenChange={() => setCible(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;activation</DialogTitle>
            <DialogDescription>
              Des tickets seront générés automatiquement sur le routeur.
            </DialogDescription>
          </DialogHeader>
          {cible && (
            <div className="flex flex-col gap-1 text-sm">
              <p>Utilisateur : {cible.utilisateur_id}</p>
              <p>Routeur : {cible.routeur_nom}</p>
              <p>Profil : {cible.profil}</p>
              <p>Seuil : {cible.seuil} tickets neufs</p>
              <p>Quantité cible : {cible.quantite_cible}</p>
              <p>Canal : {cible.canal} ({cible.destinataire || "—"})</p>
              <p>Fréquence : toutes les {cible.frequence_minutes} minutes</p>
              <p className="font-bold">
                Avertissement : des tickets seront générés automatiquement
                dès que le stock passera à {cible.seuil} ou moins.
              </p>
              {cible.blocages.length > 0 && (
                <p>Points bloquants : {cible.blocages.join(" ")}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCible(null)}>Annuler</Button>
            <Button
              disabled={occupe || (cible?.blocages.length ?? 0) > 0}
              onClick={() => cible && void changerActivation(cible, true)}
            >
              Je confirme l&apos;activation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PageReapprovisionnement() {
  const [initiales] = useState(promesseDonnees);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Contenu initiales={initiales} />
      </Suspense>
    </main>
  );
}
