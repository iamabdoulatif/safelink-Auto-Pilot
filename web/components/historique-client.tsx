"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Search, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// Historique refait pour ne plus noyer l'écran : par défaut seules
// les générations réelles (et les échecs) s'affichent. Les contrôles
// toutes les 15 minutes vivent dans leur onglet, sont archivés tout
// seuls après 30 jours, et les archives se suppriment (admin).
type Lot = {
  run_id: string;
  routeur_nom: string | null;
  profil: string;
  stock_avant: number | null;
  seuil: number | null;
  quantite_demandee: number;
  quantite_creee: number;
  canal_envoi: string;
  destinataire: string | null;
  statut: string;
  erreur: string | null;
  simulation: boolean;
  debut_le: string;
  fin_le: string | null;
};

type Compteurs = {
  generations: number; echecs: number; controles: number; archives: number;
};

type Vue = "significatifs" | "controles" | "archives";
const PAGE = 20;

function jour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

export function HistoriqueClient() {
  const [vue, setVue] = useState<Vue>("significatifs");
  const [lots, setLots] = useState<Lot[]>([]);
  const [compteurs, setCompteurs] = useState<Compteurs | null>(null);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [peutChargerPlus, setPeutChargerPlus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dialogueSuppression, setDialogueSuppression] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async (v: Vue, avant?: string) => {
    setChargement(true);
    try {
      const params = new URLSearchParams({ vue: v, limite: String(PAGE) });
      if (avant) params.set("avant", avant);
      const r = await fetch(`/api/historique?${params}`, { cache: "no-store" });
      const j = (await r.json()) as {
        data?: { lots: Lot[]; compteurs: Compteurs }; error?: string;
      };
      if (!r.ok) {
        setErreur(j.error ?? "Lecture impossible.");
        return;
      }
      const recus = j.data?.lots ?? [];
      setLots((anciens) => (avant ? [...anciens, ...recus] : recus));
      setCompteurs(j.data?.compteurs ?? null);
      setPeutChargerPlus(recus.length === PAGE);
    } catch {
      setErreur("Lecture impossible.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    setLots([]);
    void charger(vue);
  }, [vue, charger]);

  const visibles = lots.filter((l) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return (l.routeur_nom ?? "").toLowerCase().includes(q)
      || l.profil.toLowerCase().includes(q);
  });

  const parJour = new Map<string, Lot[]>();
  for (const l of visibles) {
    const cle = jour(l.debut_le);
    parJour.set(cle, [...(parJour.get(cle) ?? []), l]);
  }

  async function archiver() {
    setOccupe(true); setMessage(null); setErreur(null);
    try {
      const r = await fetch("/api/historique", { method: "POST" });
      const j = (await r.json()) as { data?: { archives: number }; error?: string };
      if (!r.ok) { setErreur(j.error ?? "Archivage impossible."); return; }
      setMessage(`${j.data?.archives ?? 0} contrôles archivés.`);
      await charger(vue);
    } catch { setErreur("Archivage impossible."); }
    finally { setOccupe(false); }
  }

  async function supprimerArchives() {
    setOccupe(true); setMessage(null); setErreur(null);
    try {
      const r = await fetch("/api/historique", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const j = (await r.json()) as { data?: { supprimes: number }; error?: string };
      if (!r.ok) { setErreur(j.error ?? "Suppression impossible."); return; }
      setMessage(`${j.data?.supprimes ?? 0} lignes archivées supprimées.`);
      setDialogueSuppression(false); setConfirmation("");
      await charger(vue);
    } catch { setErreur("Suppression impossible."); }
    finally { setOccupe(false); }
  }

  const onglets: { vue: Vue; libelle: string; compteur?: number }[] = [
    { vue: "significatifs", libelle: "Générations", compteur: compteurs?.generations },
    { vue: "controles", libelle: "Contrôles de stock", compteur: compteurs?.controles },
    { vue: "archives", libelle: "Archives", compteur: compteurs?.archives },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4">
          <p className="font-display text-2xl font-semibold tabular-nums">{compteurs?.generations ?? "—"}</p>
          <p className="text-sm text-muted-foreground">générations réelles (30 jours)</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="font-display text-2xl font-semibold tabular-nums">{compteurs?.echecs ?? "—"}</p>
          <p className="text-sm text-muted-foreground">échecs à traiter</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="font-display text-2xl font-semibold tabular-nums">{compteurs?.controles ?? "—"}</p>
          <p className="text-sm text-muted-foreground">contrôles de routine, archivés seuls après 30 jours</p>
        </CardContent></Card>
      </div>

      {erreur && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {onglets.map((o) => (
          <Button key={o.vue} size="sm"
            variant={vue === o.vue ? "default" : "outline"}
            onClick={() => setVue(o.vue)}>
            {o.libelle}{o.compteur !== undefined ? ` (${o.compteur})` : ""}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search aria-hidden="true" className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filtrer routeur ou profil…"
            value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={occupe} onClick={() => void archiver()}>
          <Archive data-icon="inline-start" aria-hidden="true" />
          Archiver la routine de +30 jours
        </Button>
        <Button size="sm" variant="destructive" disabled={occupe}
          onClick={() => setDialogueSuppression(true)}>
          <Trash2 data-icon="inline-start" aria-hidden="true" />
          Supprimer les archives
        </Button>
      </div>

      {chargement && lots.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
        </div>
      ) : visibles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="font-medium">
              {vue === "significatifs" && "Aucune génération réelle pour l'instant"}
              {vue === "controles" && "Aucun contrôle de routine à afficher"}
              {vue === "archives" && "Aucune archive pour l'instant"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {vue === "significatifs"
                ? "Les contrôles toutes les 15 minutes sont dans l'onglet Contrôles de stock."
                : "Les contrôles de plus de 30 jours arrivent ici tout seuls."}
            </p>
          </CardContent>
        </Card>
      ) : (
        [...parJour.entries()].map(([jourLibelle, duJour]) => (
          <div key={jourLibelle} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground first-letter:uppercase">
              {jourLibelle} · {duJour.length} entrée{duJour.length > 1 ? "s" : ""}
            </h2>
            {duJour.map((l) => (
              <Card key={l.run_id}>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <CardTitle className="truncate text-base">
                    {l.routeur_nom ?? "?"} · {l.profil}
                  </CardTitle>
                  {l.statut === "echoue" ? (
                    <Badge variant="destructive">{l.statut}</Badge>
                  ) : l.statut === "en_cours" || l.statut === "en_attente" ? (
                    <Badge className="bg-signal text-white">{l.statut}</Badge>
                  ) : (
                    <Badge className="bg-accent text-accent-foreground">{l.statut}</Badge>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>
                    Demandés : {l.quantite_demandee} · créés : {l.quantite_creee}
                    {" "}· stock avant : {l.stock_avant ?? "—"} · seuil : {l.seuil ?? "—"}
                    {" "}· canal : {l.canal_envoi}
                    {l.simulation ? " · simulation" : ""}
                  </p>
                  <p>
                    {new Date(l.debut_le).toLocaleTimeString("fr-FR")}
                    {l.fin_le ? ` → ${new Date(l.fin_le).toLocaleTimeString("fr-FR")}` : ""}
                    {l.destinataire ? ` · vers ${l.destinataire}` : ""}
                  </p>
                  {l.erreur && <p className="text-status-critique">Erreur : {l.erreur}</p>}
                  <details>
                    <summary className="cursor-pointer text-xs">Run {l.run_id}</summary>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}

      {peutChargerPlus && (
        <Button variant="outline" disabled={chargement}
          onClick={() => void charger(vue, lots[lots.length - 1]?.debut_le)}>
          Charger plus
        </Button>
      )}

      <Dialog open={dialogueSuppression} onOpenChange={setDialogueSuppression}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supprimer les archives ?</DialogTitle>
            <DialogDescription>
              Suppression définitive, base uniquement (aucun effet sur le routeur).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <Alert variant="destructive">
              <AlertTitle>⚠️ Avertissement</AlertTitle>
              <AlertDescription>
                Les {compteurs?.archives ?? 0} lignes archivées (contrôles de routine
                de plus de 30 jours) seront effacées pour toujours.
                Les générations réelles ne sont jamais archivées ni supprimées ici.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmation-archives">Tapez SUPPRIMER pour confirmer</Label>
              <Input id="confirmation-archives" value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="SUPPRIMER" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogueSuppression(false)}>Annuler</Button>
            <Button variant="destructive" disabled={occupe || confirmation !== "SUPPRIMER"}
              onClick={() => void supprimerArchives()}>
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
