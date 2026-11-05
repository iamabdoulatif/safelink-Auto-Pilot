"use client";

import { useEffect, useState } from "react";
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
import { SelecteurProfilsHotspot } from "@/components/selecteur-profils-hotspot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Page « Générer des tickets » : routeur, connexion Mikhmon, profil,
// quantité, durée, limite de volume, préfixe, canal (Telegram, WhatsApp,
// PrintNode, PDF, interface). Récapitulatif OBLIGATOIRE, puis validation
// humaine explicite avant toute écriture. « Les tickets sont créés dans
// RouterOS et deviennent visibles dans Mikhmon. »
type Connexion = { id: number; nom: string; actif?: boolean };

type Apercu = {
  routeur: string;
  connexion_mikhmon: string | null;
  profil: string;
  quantite: number;
  duree: string;
  volume: string;
  prefixe: string;
  canal: string;
  destinataire: string;
  note: string;
  validation_requise: string;
};

type Resultat = {
  lot_id: number;
  execution_id: number;
  cle_idempotence: string;
  statut: string;
  profil: string;
  quantite_demandee: number;
};

const CANAUX: { valeur: string; titre: string; aide: string }[] = [
  ["telegram", "Telegram", "Envoyer via le bot configuré."],
  ["whatsapp", "WhatsApp", "Envoyer via l'adaptateur configuré."],
  ["printnode", "PrintNode", "Imprimer (config testée requise)."],
  ["pdf", "PDF (téléchargement)", "Préparer un document imprimable."],
  ["interface", "Interface", "Afficher les tickets à l'écran."],
].map(([valeur, titre, aide]) => ({ valeur, titre, aide }));

function Contenu() {
  // Liste chargée uniquement côté client : le premier rendu (serveur et
  // client) est identique, ce qui évite toute erreur d'hydratation.
  const [connexions, setConnexions] = useState<Connexion[]>([]);
  const [chargementConnexions, setChargementConnexions] = useState(true);
  const [routeurId, setRouteurId] = useState("");
  const [mikhmonId, setMikhmonId] = useState("");
  const [profil, setProfil] = useState("");
  const [quantite, setQuantite] = useState("20");
  const [duree, setDuree] = useState("");
  const [volume, setVolume] = useState("");
  const [prefixe, setPrefixe] = useState("");
  const [canal, setCanal] = useState("telegram");
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [dialogueOuvert, setDialogueOuvert] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch("/api/connexions-mikhmon", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: Connexion[] }>)
      .then((j) => {
        if (annule) return;
        const liste = (j.data ?? []).filter((c) => c.actif !== false);
        setConnexions(liste);
        if (liste.length === 1) setRouteurId(String(liste[0].id));
      })
      .catch(() => {})
      .finally(() => {
        if (!annule) setChargementConnexions(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  async function demander(confirme: boolean) {
    setErreur(null);
    setOccupe(true);
    try {
      const r = await fetch("/api/tickets/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeur_id: Number(routeurId),
          mikhmon_connection_id: mikhmonId ? Number(mikhmonId) : null,
          profil,
          quantite: Number(quantite),
          duree,
          volume,
          prefixe,
          canal,
          confirme,
        }),
      });
      const j = (await r.json()) as {
        data?: Apercu | Resultat;
        error?: string;
      };
      if (!r.ok) {
        setErreur(j.error ?? "Échec de la demande.");
        return;
      }
      if (!confirme) {
        setApercu(j.data as Apercu);
        setDialogueOuvert(true);
      } else {
        setDialogueOuvert(false);
        setApercu(null);
        setResultat(j.data as Resultat);
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
      {resultat && (
        <Alert>
          <AlertTitle>Lot lancé</AlertTitle>
          <AlertDescription>
            Lot {resultat.lot_id} : {resultat.quantite_demandee} ticket(s),
            profil {resultat.profil} — statut {resultat.statut}. Les mots de
            passe vivent dans le routeur, pas dans cette application.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Demande</CardTitle>
          <CardDescription>
            Les tickets sont créés dans RouterOS et deviennent visibles
            dans Mikhmon. D&apos;abord le récapitulatif, ensuite votre
            validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="routeur">Routeur</Label>
              <select
                id="routeur"
                value={routeurId}
                disabled={chargementConnexions}
                onChange={(e) => {
                  setRouteurId(e.target.value);
                  setProfil("");
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="">
                  {chargementConnexions ? "Chargement…" : "— Choisir —"}
                </option>
                {connexions.map((x) => (
                  <option key={x.id} value={String(x.id)}>
                    {x.nom}
                  </option>
                ))}
              </select>
              {!chargementConnexions && connexions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune configuration : commencez par Mes connexions
                  Mikhmon.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mikhmon">Connexion Mikhmon (rappel)</Label>
              <select
                id="mikhmon"
                value={mikhmonId}
                onChange={(e) => setMikhmonId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
              >
                <option value="">— Aucune —</option>
                {connexions.map((x) => (
                  <option key={x.id} value={String(x.id)}>
                    {x.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profil">Profil Hotspot</Label>
              <SelecteurProfilsHotspot
                id="profil"
                configurationId={routeurId}
                value={profil}
                onChange={setProfil}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantite">Quantité (1 à 500)</Label>
              <Input
                id="quantite"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prefixe">Préfixe (optionnel)</Label>
              <Input
                id="prefixe"
                value={prefixe}
                onChange={(e) => setPrefixe(e.target.value)}
                maxLength={12}
                placeholder="—"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duree">Durée (optionnel, ex. 2h)</Label>
              <Input
                id="duree"
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder="illimitée"
                maxLength={32}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="volume">Volume (optionnel, ex. 500Mo)</Label>
              <Input
                id="volume"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="illimité"
                maxLength={32}
              />
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              Canal de livraison
            </legend>
            {CANAUX.map((c) => (
              <label
                key={c.valeur}
                className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm"
              >
                <input
                  type="radio"
                  name="canal"
                  value={c.valeur}
                  checked={canal === c.valeur}
                  onChange={() => setCanal(c.valeur)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{c.titre}</span>
                  <span className="block text-muted-foreground">{c.aide}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="pt-1">
            <Button
              type="button"
              disabled={occupe || !routeurId || !profil}
              onClick={() => void demander(false)}
            >
              Voir le récapitulatif
            </Button>
            {!profil && (
              <p className="mt-1 text-sm text-muted-foreground">
                Choisissez un routeur puis un profil Hotspot pour continuer.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogueOuvert} onOpenChange={setDialogueOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Récapitulatif — validation requise</DialogTitle>
            <DialogDescription>
              Vérifiez chaque ligne. « Valider et générer » écrit de vrais
              tickets sur le routeur.
            </DialogDescription>
          </DialogHeader>
          {apercu && (
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Routeur</dt>
                <dd className="font-medium">{apercu.routeur}</dd>
              </div>
              {apercu.connexion_mikhmon && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Mikhmon</dt>
                  <dd className="font-medium">{apercu.connexion_mikhmon}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Profil</dt>
                <dd className="font-medium">{apercu.profil}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Quantité</dt>
                <dd className="font-medium">{apercu.quantite}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Durée</dt>
                <dd className="font-medium">{apercu.duree}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Volume</dt>
                <dd className="font-medium">{apercu.volume}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Préfixe</dt>
                <dd className="font-medium">{apercu.prefixe}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Canal</dt>
                <dd>
                  <Badge variant="secondary">{apercu.canal}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Destinataire</dt>
                <dd className="font-medium">{apercu.destinataire}</dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={occupe}
              onClick={() => setDialogueOuvert(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={occupe}
              className="bg-signal text-white hover:bg-signal/90"
              onClick={() => void demander(true)}
            >
              Valider et générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GenererTickets() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Générer des tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les tickets sont créés dans RouterOS et deviennent visibles dans
          Mikhmon. Aucune écriture avant votre validation du récapitulatif.
        </p>
      </div>
      <Contenu />
    </main>
  );
}
