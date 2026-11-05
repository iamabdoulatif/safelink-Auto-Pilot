import type { ReactNode } from "react";

// En-tête standard des pages du dashboard : titre, courte description
// métier et éventuel résumé en pastilles. Même principe visuel que la
// page Réapprovisionnement (entrée animée, hiérarchie nette).
export function EntetePage({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="hero-entree flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{titre}</h1>
      {description ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
