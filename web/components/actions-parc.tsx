"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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

// Boutons Modifier / Supprimer d'une carte du parc. La modification
// renomme (nom + URL affiches) ; la suppression retire le routeur de
// l'inventaire applicatif, jamais du routeur lui-meme. Toute erreur
// serveur s'affiche en clair, sans recharger la page en echec.
export function ActionsParc(
  { id, nom, urlBase }: { id: number; nom: string; urlBase: string },
) {
  const rafraichir = useRouter();
  const [modification, setModification] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [nomSaisi, setNomSaisi] = useState(nom);
  const [urlSaisie, setUrlSaisie] = useState(urlBase);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setOccupe(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/parc/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nomSaisi, url_base: urlSaisie }),
      });
      const corps = (await reponse.json()) as {
        data?: unknown; error?: string;
      };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Modification impossible.");
        return;
      }
      setModification(false);
      rafraichir.refresh();
    } catch {
      setErreur("Modification impossible.");
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer() {
    setOccupe(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/parc/${id}`, { method: "DELETE" });
      const corps = (await reponse.json()) as {
        data?: unknown; error?: string;
      };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Suppression impossible.");
        return;
      }
      setSuppression(false);
      rafraichir.refresh();
    } catch {
      setErreur("Suppression impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setNomSaisi(nom);
          setUrlSaisie(urlBase);
          setErreur(null);
          setModification(true);
        }}
      >
        <Pencil data-icon="inline-start" />
        Modifier
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setErreur(null);
          setSuppression(true);
        }}
      >
        <Trash2 data-icon="inline-start" />
        Supprimer
      </Button>

      <Dialog open={modification} onOpenChange={setModification}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le routeur</DialogTitle>
            <DialogDescription>
              Nom et URL affichés dans le parc. Le modèle reste renseigné
              par la collecte.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`nom-${id}`}>Nom</Label>
              <Input
                id={`nom-${id}`}
                value={nomSaisi}
                onChange={(e) => setNomSaisi(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`url-${id}`}>URL de base</Label>
              <Input
                id={`url-${id}`}
                value={urlSaisie}
                onChange={(e) => setUrlSaisie(e.target.value)}
                inputMode="url"
                maxLength={200}
              />
            </div>
            {erreur && (
              <Alert variant="destructive">
                <AlertTitle>Échec</AlertTitle>
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModification(false)}
            >
              Annuler
            </Button>
            <Button disabled={occupe} onClick={() => void enregistrer()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suppression} onOpenChange={setSuppression}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce routeur ?</DialogTitle>
            <DialogDescription>
              « {nom} » sortira du parc. Le routeur lui-même n&apos;est
              pas touché.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Ses relevés et ses constats seront supprimés en cascade.
              Si des règles de réapprovisionnement le référencent encore,
              la suppression sera refusée : désactivez-les d&apos;abord.
            </p>
            {erreur && (
              <Alert variant="destructive">
                <AlertTitle>Suppression refusée</AlertTitle>
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuppression(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={occupe}
              onClick={() => void supprimer()}
            >
              Oui, supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
