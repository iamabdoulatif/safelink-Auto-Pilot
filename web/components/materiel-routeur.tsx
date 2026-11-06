import type { ReactNode } from "react";
import { Cpu, MemoryStick, Router } from "lucide-react";
import { lireMaterielRouteur } from "@/lib/materiel-routeur";
import { formaterMemoire } from "@/lib/extraire-materiel";
import { cn } from "@/lib/utils";

// Modèle, CPU et RAM lus en direct à chaque visite du tableau de bord,
// depuis /system/resource et /system/routerboard du routeur.
export async function MaterielRouteur({
  tenantId,
  routeurId,
  urlBase,
  modeleConnu,
}: {
  tenantId: string;
  routeurId: number;
  urlBase: string;
  modeleConnu: string | null;
}) {
  const m = await lireMaterielRouteur(tenantId, routeurId, urlBase);
  if (!m) {
    return (
      <dl className="flex flex-col gap-2.5">
        <LigneInfo icone={<Router aria-hidden="true" className="size-4" />} libelle="Modèle">
          {modeleConnu ?? "Inconnu"}
        </LigneInfo>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          CPU et RAM indisponibles : routeur injoignable ou compte de lecture
          absent.
        </p>
      </dl>
    );
  }

  const ramUtilisee =
    m.ramTotale !== null && m.ramLibre !== null && m.ramTotale > 0
      ? Math.min(100, Math.max(0, Math.round(((m.ramTotale - m.ramLibre) / m.ramTotale) * 100)))
      : null;

  return (
    <dl className="flex flex-col gap-3">
      <LigneInfo icone={<Router aria-hidden="true" className="size-4" />} libelle="Modèle">
        <span className="font-medium text-foreground">{m.modele ?? "Inconnu"}</span>
        {m.version ? (
          <span className="block text-xs">RouterOS {m.version}</span>
        ) : null}
      </LigneInfo>

      <div>
        <LigneInfo icone={<Cpu aria-hidden="true" className="size-4" />} libelle="Processeur">
          <span className="font-medium text-foreground">{m.cpu ?? "Inconnu"}</span>
          <span className="block text-xs">
            {m.coeurs !== null
              ? `${m.coeurs} cœur${m.coeurs > 1 ? "s" : ""}`
              : "Cœurs inconnus"}
            {m.chargeCpu !== null ? ` · charge actuelle ${m.chargeCpu} %` : ""}
          </span>
        </LigneInfo>
        {m.chargeCpu !== null ? (
          <BarreUtilisation valeur={m.chargeCpu} libelle="Charge du processeur" />
        ) : null}
      </div>

      <div>
        <LigneInfo
          icone={<MemoryStick aria-hidden="true" className="size-4" />}
          libelle="Mémoire RAM"
        >
          {m.ramTotale !== null && m.ramLibre !== null ? (
            <>
              <span className="font-medium text-foreground">
                {formaterMemoire(m.ramTotale - m.ramLibre)} utilisée
              </span>
              <span className="block text-xs">
                {formaterMemoire(m.ramLibre)} libres sur {formaterMemoire(m.ramTotale)}
                {ramUtilisee !== null ? ` · ${ramUtilisee} %` : ""}
              </span>
            </>
          ) : (
            <span className="font-medium text-foreground">Inconnue</span>
          )}
        </LigneInfo>
        {ramUtilisee !== null ? (
          <BarreUtilisation valeur={ramUtilisee} libelle="Utilisation de la mémoire RAM" />
        ) : null}
      </div>
    </dl>
  );
}

function LigneInfo({
  icone,
  libelle,
  children,
}: {
  icone: ReactNode;
  libelle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/55 text-foreground">
        {icone}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{libelle}</dt>
        <dd className="leading-snug text-muted-foreground">{children}</dd>
      </div>
    </div>
  );
}

function BarreUtilisation({ valeur, libelle }: { valeur: number; libelle: string }) {
  const pourcentage = Math.min(100, Math.max(0, valeur));
  return (
    <div
      className="mt-1.5 ml-9 h-1.5 overflow-hidden rounded-full bg-secondary"
      role="img"
      aria-label={`${libelle} : ${pourcentage} %`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          pourcentage >= 85
            ? "bg-status-critique"
            : pourcentage >= 65
              ? "bg-status-majeur"
              : "bg-accent",
        )}
        style={{ width: `${pourcentage}%` }}
      />
    </div>
  );
}
