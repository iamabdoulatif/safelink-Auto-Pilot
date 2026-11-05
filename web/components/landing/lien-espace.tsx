"use client";

import { useEffect, useState, type AnchorHTMLAttributes, type Ref } from "react";

// État de session côté visiteur, partagé par tous les liens « espace »
// de la landing : une seule requête pour toute la page. Tant qu'elle
// n'a pas répondu, on suppose un visiteur anonyme.
let promesseEtat: Promise<boolean> | null = null;

function etatConnecte(): Promise<boolean> {
  promesseEtat ??= fetch("/api/auth/etat")
    .then((r) => r.json() as Promise<{ data?: { connecte?: boolean } }>)
    .then((corps) => corps.data?.connecte === true)
    .catch(() => false);
  return promesseEtat;
}

export function useConnecte(): boolean | null {
  const [connecte, setConnecte] = useState<boolean | null>(null);
  useEffect(() => {
    let actif = true;
    etatConnecte().then((v) => {
      if (actif) setConnecte(v);
    });
    return () => {
      actif = false;
    };
  }, []);
  return connecte;
}

// Lien « Accéder à mon espace » : visiteur anonyme vers la connexion,
// utilisateur connecté directement vers son tableau de bord (/).
export function LienEspace({
  ref,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: Ref<HTMLAnchorElement> }) {
  const connecte = useConnecte();
  return <a ref={ref} href={connecte ? "/" : "/connexion"} {...props} />;
}
