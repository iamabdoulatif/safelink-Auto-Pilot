"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Synchro = { ajoutes: string[]; misAJour: string[]; erreurs: string[] };

async function synchroniser(): Promise<Synchro | null> {
  const r = await fetch("/api/safelinkhub/synchroniser", { method: "POST" }).catch(() => null);
  if (!r || !r.ok) return null;
  return ((await r.json()) as { data?: Synchro }).data ?? null;
}

// Reconnaissance silencieuse à l'ouverture du tableau de bord : tout routeur
// déjà connecté à SafeLinkHub (organisation liée) et absent du parc y entre.
export function SynchroSafelinkhub() {
  const rafraichir = useRouter();
  const fait = useRef(false);
  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    void synchroniser().then((s) => {
      if (s && s.ajoutes.length + s.misAJour.length > 0) rafraichir.refresh();
    });
  }, [rafraichir]);
  return null;
}

// Ajoute un routeur au parc. Méthode par défaut : ligne à coller dans le
// terminal MikroTik, générée par SafeLinkHub (seul gestionnaire WireGuard) ;
// un routeur qui porte déjà le tunnel SafeLinkHub n'est pas réinstallé, il
// est reconnu et ajouté automatiquement. L'adresse manuelle reste possible.
export function AjouterParc() {
  const rafraichir = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nomSaisi, setNomSaisi] = useState("");
  const [urlSaisie, setUrlSaisie] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lie, setLie] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [commande, setCommande] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [attente, setAttente] = useState<string | null>(null);
  const [manuel, setManuel] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (minuterie.current) clearInterval(minuterie.current); }, []);

  function reinitialiser() {
    setNomSaisi("");
    setUrlSaisie("");
    setErreur(null);
    setCommande(null);
    setCopie(false);
    setAttente(null);
    setManuel(false);
    if (minuterie.current) clearInterval(minuterie.current);
  }

  async function lireLiaison() {
    const r = await fetch("/api/safelinkhub", { cache: "no-store" }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { data?: { lie?: boolean } }) : {};
    setLie(!!j.data?.lie);
  }

  async function lier() {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await fetch("/api/safelinkhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErreur(j.error ?? "Liaison impossible."); return; }
      setCode("");
      setLie(true);
      void attendreReconnaissance(false);
    } finally {
      setOccupe(false);
    }
  }

  // Interroge la synchronisation toutes les 10 s (5 min au plus) jusqu'à ce
  // qu'un routeur entre dans le parc.
  async function attendreReconnaissance(longue = true) {
    if (minuterie.current) clearInterval(minuterie.current);
    setAttente("Recherche des routeurs SafeLinkHub…");
    const fin = Date.now() + (longue ? 5 * 60_000 : 15_000);
    const tour = async () => {
      const s = await synchroniser();
      const nouveaux = s ? [...s.ajoutes, ...s.misAJour] : [];
      if (nouveaux.length) {
        if (minuterie.current) clearInterval(minuterie.current);
        setAttente("Ajouté au parc : " + nouveaux.join(", "));
        rafraichir.refresh();
        return;
      }
      if (Date.now() > fin) {
        if (minuterie.current) clearInterval(minuterie.current);
        setAttente(
          s?.erreurs.length
            ? "Pas encore ajouté : " + s.erreurs.join(" ; ")
            : longue
              ? "Aucun nouveau routeur détecté. Vérifiez que la ligne a bien été collée, puis relancez la recherche."
              : "Aucun nouveau routeur : tous vos routeurs SafeLinkHub sont déjà dans le parc.",
        );
      }
    };
    await tour();
    if (longue) minuterie.current = setInterval(() => void tour(), 10_000);
  }

  async function genererScript() {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await fetch("/api/safelinkhub/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nomSaisi }),
      });
      const j = (await r.json().catch(() => ({}))) as { data?: { commande: string }; error?: string };
      if (!r.ok || !j.data) { setErreur(j.error ?? "Génération impossible."); return; }
      setCommande(j.data.commande);
      void attendreReconnaissance(true);
    } finally {
      setOccupe(false);
    }
  }

  async function ajouter() {
    setOccupe(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/routeurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nomSaisi, url_base: urlSaisie }),
      });
      const corps = (await reponse.json()) as {
        data?: unknown; error?: string;
      };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Ajout impossible.");
        return;
      }
      setOuvert(false);
      reinitialiser();
      rafraichir.refresh();
    } catch {
      setErreur("Ajout impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          reinitialiser();
          setOuvert(true);
          void lireLiaison();
        }}
      >
        <Plus data-icon="inline-start" />
        Ajouter un routeur
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un routeur</DialogTitle>
            <DialogDescription>
              Collez une ligne dans le terminal du MikroTik : le routeur
              rejoint le tunnel WireGuard de SafeLinkHub et entre seul dans
              le parc. S&apos;il est déjà connecté à SafeLinkHub, rien
              n&apos;est réinstallé : il est reconnu automatiquement.
            </DialogDescription>
          </DialogHeader>
          {!manuel && (
            <div className="flex flex-col gap-3 text-sm">
              {lie === null && <p className="text-muted-foreground">Chargement…</p>}
              {lie === false && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground">
                    Liez d&apos;abord votre compte : SafeLinkHub → Réglages →
                    Avancé → « Générer un code de liaison ».
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Code de liaison"
                      maxLength={20}
                      className="font-mono uppercase"
                    />
                    <Button disabled={occupe || code.trim().length < 8} onClick={() => void lier()}>
                      Lier
                    </Button>
                  </div>
                </div>
              )}
              {lie && !commande && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="parc-nom">Nom du routeur</Label>
                  <Input
                    id="parc-nom"
                    value={nomSaisi}
                    onChange={(e) => setNomSaisi(e.target.value)}
                    maxLength={64}
                    placeholder="HSPT-QUARTIER"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={occupe || nomSaisi.trim().length < 2} onClick={() => void genererScript()}>
                      Générer la ligne à coller
                    </Button>
                    <Button variant="outline" disabled={occupe} onClick={() => void attendreReconnaissance(false)}>
                      Déjà sur SafeLinkHub ? Synchroniser
                    </Button>
                  </div>
                </div>
              )}
              {commande && (
                <div className="flex flex-col gap-2">
                  <p>
                    WinBox → <b>New Terminal</b>, collez cette ligne puis
                    Entrée (valable 2 h, usage unique) :
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted p-2 font-mono text-xs">
                    {commande}
                  </pre>
                  <Button
                    variant="outline"
                    className="w-fit"
                    onClick={() => {
                      void navigator.clipboard.writeText(commande).then(() => setCopie(true));
                    }}
                  >
                    {copie ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                    {copie ? "Copiée" : "Copier la ligne"}
                  </Button>
                </div>
              )}
              {attente && <p className="text-muted-foreground">{attente}</p>}
              {erreur && (
                <Alert variant="destructive">
                  <AlertTitle>Échec</AlertTitle>
                  <AlertDescription>{erreur}</AlertDescription>
                </Alert>
              )}
              <button
                type="button"
                className="w-fit text-xs text-muted-foreground underline"
                onClick={() => setManuel(true)}
              >
                Saisir une adresse REST à la main (avancé)
              </button>
            </div>
          )}
          {manuel && (
            <>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Nom :</span>{" "}
              étiquette libre, sans effet technique.
            </p>
            <p>
              <span className="font-medium text-foreground">URL :</span>{" "}
              base de l&apos;API REST en https:// (certificat auto-signé
              accepté). Local : https://192.168.88.1. Labo CHR : adresse
              rendue par quickchr inspect (ex. http://127.0.0.1:9150).
              Distant : https://routeur.mondomaine.tld (HTTPS joignable :
              VPN ou redirection de port).
            </p>
            <p>
              <span className="font-medium text-foreground">
                Pas de port 8728 :
              </span>{" "}
              c&apos;est l&apos;ancienne API / Winbox. Winbox utilise le
              port 8291 et reste un outil manuel : rien à saisir ici.
            </p>
            <p>
              <span className="font-medium text-foreground">Mikhmon :</span>{" "}
              adresse séparée, à saisir dans « Mes connexions Mikhmon »
              (local : http://127.0.0.1:8088 ; distant : URL du serveur ;
              depuis n8n Docker : http://host.docker.internal:8088).
            </p>
            <p>
              Le test utilise le compte lecture de web/.env.local
              (ROUTEROS_USER / ROUTEROS_PASS) : il doit exister sur ce
              routeur.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="parc-nom-manuel">Nom</Label>
              <Input
                id="parc-nom-manuel"
                value={nomSaisi}
                onChange={(e) => setNomSaisi(e.target.value)}
                maxLength={100}
                placeholder="Site A — salle serveur"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="parc-url">URL de base de l&apos;API</Label>
              <Input
                id="parc-url"
                value={urlSaisie}
                onChange={(e) => setUrlSaisie(e.target.value)}
                inputMode="url"
                maxLength={200}
                placeholder="https://192.168.88.1"
              />
            </div>
            {erreur && (
              <Alert variant="destructive">
                <AlertTitle>Ajout refusé</AlertTitle>
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}
          </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvert(false)}>
              {commande ? "Fermer" : "Annuler"}
            </Button>
            {manuel && (
              <Button disabled={occupe} onClick={() => void ajouter()}>
                Vérifier et ajouter
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
