"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

// Ajoute un routeur au parc : nom + URL de base, connectivite verifiee
// cote serveur avant inscription. Un routeur injoignable est refuse.
export function AjouterParc() {
  const rafraichir = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nomSaisi, setNomSaisi] = useState("");
  const [urlSaisie, setUrlSaisie] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function reinitialiser() {
    setNomSaisi("");
    setUrlSaisie("");
    setErreur(null);
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
              Le routeur doit répondre à l&apos;API REST pour être
              inscrit : l&apos;adresse est testée avant l&apos;ajout.
            </DialogDescription>
          </DialogHeader>
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
              <Label htmlFor="parc-nom">Nom</Label>
              <Input
                id="parc-nom"
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button disabled={occupe} onClick={() => void ajouter()}>
              Vérifier et ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
