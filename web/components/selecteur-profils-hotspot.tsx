"use client";

import { useEffect, useState } from "react";

type Profil = { nom: string; serveur: string | null };

type Props = {
  configurationId: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

// Charge les profils utilisateur du routeur sélectionné via le serveur.
// Les identifiants RouterOS ne quittent jamais les route handlers.
export function SelecteurProfilsHotspot({
  configurationId,
  id,
  value,
  onChange,
  className,
}: Props) {
  const [profils, setProfils] = useState<Profil[]>([]);
  const [chargeePour, setChargeePour] = useState<string | null>(null);
  const [erreur, setErreur] = useState<{
    configurationId: string;
    message: string;
  } | null>(null);

  const erreurCourante = erreur?.configurationId === configurationId
    ? erreur.message
    : null;
  const chargement = Boolean(configurationId)
    && chargeePour !== configurationId
    && !erreurCourante;
  const profilsAffiches = chargeePour === configurationId ? profils : [];

  useEffect(() => {
    let annule = false;
    if (!configurationId) return () => { annule = true; };

    fetch(`/api/routeurs-config/${encodeURIComponent(configurationId)}/profils`, {
      cache: "no-store",
    })
      .then(async (reponse) => {
        const corps = (await reponse.json()) as {
          data?: Profil[];
          error?: string;
        };
        if (!reponse.ok) throw new Error(corps.error ?? "Lecture impossible.");
        if (!annule) {
          setProfils(corps.data ?? []);
          setChargeePour(configurationId);
        }
      })
      .catch((cause: unknown) => {
        if (!annule) {
          setErreur({
            configurationId,
            message: cause instanceof Error ? cause.message : "Lecture impossible.",
          });
        }
      });

    return () => { annule = true; };
  }, [configurationId]);

  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!configurationId || chargement}
        className={className ?? "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"}
      >
        <option value="">
          {!configurationId
            ? "Choisir d'abord un routeur"
            : chargement
              ? "Chargement des profils…"
              : "Choisir un profil"}
        </option>
        {profilsAffiches.map((profil) => (
          <option key={profil.nom} value={profil.nom}>
            {profil.nom}
          </option>
        ))}
      </select>
      {erreurCourante && <p className="text-sm text-destructive">{erreurCourante}</p>}
      {configurationId && !chargement && !erreurCourante && profilsAffiches.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun profil utilisateur trouvé sur ce routeur.
        </p>
      )}
    </>
  );
}
