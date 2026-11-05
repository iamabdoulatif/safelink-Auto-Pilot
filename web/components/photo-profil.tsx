"use client";

import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Ajout, remplacement et retrait de la photo du profil.
export function PhotoProfil({
  courriel,
  aPhoto,
}: {
  courriel: string;
  aPhoto: boolean;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [presente, setPresente] = useState(aPhoto);
  const [version, setVersion] = useState(0);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function envoyer(fichier: File) {
    setErreur("");
    setOccupe(true);
    try {
      const formulaire = new FormData();
      formulaire.append("photo", fichier);
      const r = await fetch("/api/profil/photo", { method: "POST", body: formulaire });
      const corps = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErreur(corps.error ?? "Envoi impossible.");
        return;
      }
      setPresente(true);
      setVersion((v) => v + 1);
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setOccupe(false);
      if (champ.current) champ.current.value = "";
    }
  }

  async function retirer() {
    setErreur("");
    setOccupe(true);
    try {
      const r = await fetch("/api/profil/photo", { method: "DELETE" });
      if (!r.ok) {
        setErreur("Suppression impossible.");
        return;
      }
      setPresente(false);
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-20">
          {presente ? (
            <AvatarImage
              src={`/api/profil/photo?v=${version}`}
              alt="Votre photo de profil"
              className="object-cover"
            />
          ) : null}
          <AvatarFallback className="text-2xl uppercase">
            {courriel.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <input
            ref={champ}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choisir une photo de profil"
            className="sr-only"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) void envoyer(fichier);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={occupe}
            onClick={() => champ.current?.click()}
          >
            {occupe ? "Envoi…" : presente ? "Changer la photo" : "Ajouter une photo"}
          </Button>
          {presente ? (
            <Button
              type="button"
              variant="ghost"
              disabled={occupe}
              onClick={() => void retirer()}
            >
              Retirer
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, 2 Mo maximum.</p>
      {erreur ? (
        <Alert variant="destructive">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
