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
  Download,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Printer,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
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
  destinataires_supplementaires: AutreDestinataire[];
  approbation_requise: boolean;
  approbation_canal: string;
  duree_limite: string | null;
  volume_limite_octets: number | null;
  actif: boolean;
  simulation_reussie: boolean;
  dernier_stock: number | null;
  derniere_erreur: string | null;
  blocages: string[];
};

type AutreDestinataire = { canal: "telegram" | "whatsapp"; valeur: string };

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
  const [autres, setAutres] = useState<AutreDestinataire[]>([]);
  const [approbationRequise, setApprobationRequise] = useState(false);
  const [approbationCanal, setApprobationCanal] = useState("telegram");
  const [regleEnModification, setRegleEnModification] = useState<number | null>(null);
  const [cible, setCible] = useState<Regle | null>(null);
  const [cibleSuppression, setCibleSuppression] = useState<Regle | null>(null);
  const [apercu, setApercu] = useState<{
    profil: string; routeurNom: string; sauvegarde: string;
    lignes: string[];
    plan: { total: number; neufs: number; utilises: number };
  } | null>(null);
  const [confirmationSuppression, setConfirmationSuppression] = useState("");
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
          destinatairesSupplementaires: autres,
          approbationRequise,
          approbationCanal,
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
    setAutres([]);
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
    setAutres(regle.destinataires_supplementaires ?? []);
    chargerApprobation(regle);
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

  function chargerApprobation(regle: Regle) {
    setApprobationRequise(regle.approbation_requise === true);
    setApprobationCanal(regle.approbation_canal || "telegram");
  }

  function annulerModification() {
    setRegleEnModification(null);
    setForm(VIDE);
    setAutres([]);
    setApprobationRequise(false);
    setApprobationCanal("telegram");
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

  async function demanderSuppression(regle: Regle) {
    setErreur(null); setMessage(null);
    setCibleSuppression(regle); setApercu(null); setConfirmationSuppression("");
    try {
      const r = await fetch("/api/reapprovisionnement/suppression", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regleId: regle.id }),
      });
      const j = (await r.json()) as { data?: typeof apercu; error?: string };
      if (!r.ok) { setErreur(j.error ?? "Aperçu impossible."); setCibleSuppression(null); return; }
      setApercu(j.data ?? null);
    } catch { setErreur("Aperçu impossible."); setCibleSuppression(null); }
  }

  async function confirmerSuppression() {
    if (!cibleSuppression) return;
    setOccupe(true); setErreur(null);
    try {
      const r = await fetch("/api/reapprovisionnement/suppression", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regleId: cibleSuppression.id, confirmation: confirmationSuppression }),
      });
      const j = (await r.json()) as { data?: { ticketsDesactives: number; sauvegarde: string }; error?: string };
      if (!r.ok) { setErreur(j.error ?? "Suppression impossible."); return; }
      setMessage(`Profil supprimé : ${j.data?.ticketsDesactives ?? 0} tickets désactivés sur le routeur (sauvegarde ${j.data?.sauvegarde ?? ""}).`);
      setCibleSuppression(null); setApercu(null);
      await charger();
    } catch { setErreur("Suppression impossible."); }
    finally { setOccupe(false); }
  }

  const nbActives = regles.filter((x) => x.actif).length;
  const nbPause = regles.length - nbActives;

  return (
    <div className="flex flex-col gap-6">
      <div className="hero-entree flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Réapprovisionnement automatique</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Vos règles de réassort par routeur et par profil. Une règle active
          génère ses tickets toute seule dès que le stock passe sous son seuil.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Résumé des règles">
          <li>
            <Badge variant="secondary">
              <span aria-hidden="true" className="size-2 rounded-full bg-foreground" />
              {regles.length} règle{regles.length > 1 ? "s" : ""}
            </Badge>
          </li>
          <li>
            <Badge className="bg-accent text-accent-foreground">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent-foreground" />
              {nbActives} active{nbActives > 1 ? "s" : ""}
            </Badge>
          </li>
          <li>
            <Badge className="bg-signal text-white">
              <span aria-hidden="true" className="size-2 rounded-full bg-white" />
              {nbPause} en pause
            </Badge>
          </li>
        </ul>
      </div>
      <Alert className="hero-entree border-signal/40 bg-signal/5" style={{ animationDelay: "60ms" }}>
        <RefreshCw aria-hidden="true" className="text-signal" />
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
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="border-status-ok/40 bg-status-ok/5">
          <AlertTitle>C&apos;est fait</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card className="hero-entree" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Mes règles
            <Badge className="bg-accent text-accent-foreground">{regles.length}</Badge>
          </CardTitle>
          <CardDescription>
            Une règle par routeur et profil. Seules les règles actives génèrent
            des tickets. Une règle en pause est d&apos;abord simulée
            automatiquement, sans créer de ticket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Routeur · Profil</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Génération</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regles.map((regle) => {
                const stock = regle.dernier_stock;
                const sousSeuil = stock !== null && stock <= regle.seuil;
                const largeur =
                  stock === null
                    ? 0
                    : Math.min(100, Math.round((stock / Math.max(regle.seuil * 2, stock, 1)) * 100));
                const IconeCanal =
                  regle.canal === "telegram"
                    ? Send
                    : regle.canal === "whatsapp"
                      ? MessageCircle
                      : regle.canal === "printnode"
                        ? Printer
                        : Download;
                const nomCanal =
                  regle.canal === "telegram"
                    ? "Telegram"
                    : regle.canal === "whatsapp"
                      ? "WhatsApp"
                      : regle.canal === "printnode"
                        ? "PrintNode"
                        : "Téléchargement";
                return (
                  <TableRow key={regle.id} className="transition-colors hover:bg-secondary/50">
                    <TableCell>
                      <span className="font-medium">{regle.routeur_nom}</span>
                      <span className="mt-1 flex">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {regle.profil}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell>
                      {stock === null ? (
                        <span className="text-muted-foreground">pas encore relevé</span>
                      ) : (
                        <div className="flex min-w-28 flex-col gap-1">
                          <span className={sousSeuil ? "font-semibold text-signal" : "font-semibold"}>
                            {stock} en stock
                          </span>
                          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={sousSeuil ? "h-full rounded-full bg-signal" : "h-full rounded-full bg-accent"}
                              style={{ width: `${largeur}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            seuil {regle.seuil} · toutes les {regle.frequence_minutes} min
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium tabular-nums">{regle.quantite_generation}</span>
                      <span className="block text-xs text-muted-foreground">
                        cible {regle.quantite_cible}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <IconeCanal aria-hidden="true" className="text-muted-foreground" />
                        {nomCanal}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                        {regle.actif ? (
                          <Badge className="bg-accent text-accent-foreground">
                            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent-foreground" />
                            Actif
                          </Badge>
                        ) : (
                          <Badge className="bg-signal text-white">
                            <Pause aria-hidden="true" />
                            En pause
                          </Badge>
                        )}
                        {regle.simulation_reussie ? (
                          <Badge variant="outline" className="border-signal/40 text-signal">
                            Simulation OK
                          </Badge>
                        ) : null}
                        {regle.derniere_erreur ? (
                          <span className="max-w-44 text-xs text-destructive">{regle.derniere_erreur}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                        <Button
                          disabled={occupe}
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => modifier(regle)}
                        >
                          <Pencil data-icon="inline-start" aria-hidden="true" />
                          Modifier
                        </Button>
                        <Button
                          disabled={occupe}
                          variant="destructive"
                          size="sm"
                          className="shrink-0"
                          onClick={() => void demanderSuppression(regle)}
                        >
                          <Trash2 data-icon="inline-start" aria-hidden="true" />
                          Supprimer
                        </Button>
                        {regle.actif ? (
                          <Button
                            disabled={occupe}
                            size="sm"
                            className="shrink-0 bg-signal text-white hover:bg-signal/90"
                            onClick={() => void changerActivation(regle, false)}
                          >
                            <Pause data-icon="inline-start" aria-hidden="true" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            disabled={occupe}
                            size="sm"
                            className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/85"
                            onClick={() => setCible(regle)}
                          >
                            <Play data-icon="inline-start" aria-hidden="true" />
                            Activer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {regles.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <RefreshCw aria-hidden="true" className="text-muted-foreground" />
              <p className="font-display text-lg">Aucune règle pour le moment</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Créez votre première règle ci-dessous : choisissez un routeur,
                un profil, un seuil, et le tour est joué.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="nouvelle-regle" className="hero-entree scroll-mt-6" style={{ animationDelay: "180ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-signal text-white">
              <RefreshCw />
            </span>
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
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="seuil">Seuil minimum (tickets neufs)</Label>
              <Input id="seuil" inputMode="numeric" {...champ("seuil")} />
            </div>
            <div>
              <Label htmlFor="quantite">Quantité de génération</Label>
              <select id="quantite" className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...champ("quantiteGeneration")}>
                {[120, 240, 480, 500].map((q) => (
                  <option key={q} value={q}>{q} tickets</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cible">Quantité cible</Label>
              <Input id="cible" inputMode="numeric"
                {...champ("quantiteCible")} />
            </div>
            <div>
              <Label htmlFor="frequence">Fréquence de vérification (minutes)</Label>
              <Input id="frequence" inputMode="numeric"
                {...champ("frequenceMinutes")} />
            </div>
          </div>
          <div>
            <Label htmlFor="canal">Canal de livraison</Label>
            <select id="canal" className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...champ("canal")}>
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
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={approbationRequise}
                onChange={(e) => setApprobationRequise(e.target.checked)}
              />
              <span>Demander mon approbation avant chaque génération</span>
            </label>
            {approbationRequise && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="canal-approbation">Canal d&apos;approbation</Label>
                <select id="canal-approbation" className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" value={approbationCanal} onChange={(e) => setApprobationCanal(e.target.value)}>
                  <option value="telegram">Telegram (boutons Approuver / Refuser)</option>
                  <option value="whatsapp">WhatsApp (liens Approuver / Refuser)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Vous recevrez : « Vous allez assister à une génération de
                  {" "}{form.quantiteGeneration} tickets pour {form.profil || "…"}. Vous
                  consentez ? » La génération ne part qu&apos;après votre OK.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Autres destinataires du PDF (5 maximum)</Label>
            <p className="text-xs text-muted-foreground">
              WhatsApp : numéro au format international. Telegram : chat ID, pas
              un numéro. La personne doit d&apos;abord écrire à votre bot.
            </p>
            {autres.map((autre, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Canal du destinataire ${i + 1}`}
                  value={autre.canal}
                  onChange={(e) => {
                    const canal = e.target.value as AutreDestinataire["canal"];
                    setAutres((l) => l.map((d, j) => (j === i ? { ...d, canal } : d)));
                  }}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
                <Input
                  aria-label={`Numéro ou chat ID du destinataire ${i + 1}`}
                  className="min-w-40 flex-1"
                  inputMode="tel"
                  value={autre.valeur}
                  placeholder={autre.canal === "whatsapp" ? "+2250700000000" : "123456789"}
                  onChange={(e) => {
                    const valeur = e.target.value;
                    setAutres((l) => l.map((d, j) => (j === i ? { ...d, valeur } : d)));
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAutres((l) => l.filter((_, j) => j !== i))}
                >
                  Retirer
                </Button>
              </div>
            ))}
            {autres.length < 5 && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAutres((l) => [...l, { canal: "whatsapp", valeur: "" }])}
                >
                  Ajouter un destinataire
                </Button>
              </div>
            )}
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
            <Button disabled={occupe} className="bg-signal text-white hover:bg-signal/90" onClick={() => void enregistrer()}>
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
              <p>
                Autres destinataires :{" "}
                {cible.destinataires_supplementaires?.length
                  ? cible.destinataires_supplementaires.map((d) => d.valeur).join(", ")
                  : "aucun"}
              </p>
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
            <Button variant="outline" onClick={() => setCible(null)}>Annuler</Button>
            <Button
              disabled={occupe || (cible?.blocages.length ?? 0) > 0}
              className="bg-signal text-white hover:bg-signal/90"
              onClick={() => cible && void changerActivation(cible, true)}
            >
              Je confirme l&apos;activation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cibleSuppression !== null} onOpenChange={() => { setCibleSuppression(null); setApercu(null); }}>
        <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Supprimer le profil et ses tickets ?</DialogTitle>
            <DialogDescription>
              Action définitive côté SaaS, désactivation côté routeur.
            </DialogDescription>
          </DialogHeader>
          {cibleSuppression && (
            <div className="flex min-w-0 flex-col gap-3 text-sm break-words">
              <Alert variant="destructive">
                <AlertTitle>⚠️ Avertissement — suppression du profil {cibleSuppression.profil}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4 break-words">
                    <li>La règle de réapprovisionnement de ce profil sera <strong>supprimée définitivement</strong>.</li>
                    <li>Le profil Hotspot et <strong>tous ses tickets</strong> (neufs et déjà utilisés) seront <strong>désactivés sur le routeur</strong> : plus aucune connexion possible avec ces tickets, sessions en cours coupées.</li>
                    <li>Par sécurité, rien n'est effacé sur RouterOS : un admin peut réactiver à la main dans Mikhmon. Une sauvegarde du routeur est créée avant, avec un filet de restauration.</li>
                    <li>L'historique des générations reste conservé dans le dashboard.</li>
                  </ul>
                </AlertDescription>
              </Alert>
              {apercu ? (
                <>
                  <p>
                    Routeur : {apercu.routeurNom} · Tickets concernés :{" "}
                    <strong>{apercu.plan.total}</strong> ({apercu.plan.neufs} neufs,{" "}
                    {apercu.plan.utilises} déjà utilisés) · Sauvegarde : {apercu.sauvegarde}
                  </p>
                  <div className="flex flex-col gap-1">
                    <Label>Plan exact qui sera exécuté</Label>
                    <pre className="max-h-44 overflow-x-hidden overflow-y-auto rounded-lg border bg-muted/40 p-2 text-[11px] break-all whitespace-pre-wrap">{apercu.lignes.join("\n")}</pre>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmation-suppression">
                      Pour confirmer, retapez le nom du profil : {cibleSuppression.profil}
                    </Label>
                    <Input
                      id="confirmation-suppression"
                      value={confirmationSuppression}
                      onChange={(e) => setConfirmationSuppression(e.target.value)}
                      placeholder={cibleSuppression.profil}
                      autoComplete="off"
                    />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Lecture du routeur en cours…</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCibleSuppression(null); setApercu(null); }}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={occupe || !apercu || confirmationSuppression !== cibleSuppression?.profil}
              onClick={() => void confirmerSuppression()}
            >
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              Supprimer définitivement la règle et désactiver le profil
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
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
