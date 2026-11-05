import { Activity, Cpu, MemoryStick, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Apercu fictif du tableau de bord : aucun vrai routeur, aucun vrai code.
// Il montre la forme du produit (statuts, releve, materiel) sans inventer
// de client ni de chiffre commercial.

function Pastille({ classe }: { classe: string }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${classe}`} />;
}

const ROUTEURS_EXEMPLE = [
  { nom: "Routeur — Point central", cpu: "18 %", ram: "42 %", statut: "ok" as const, releve: "Relevé il y a 4 min" },
  { nom: "Routeur — Antenne nord", cpu: "31 %", ram: "57 %", statut: "majeur" as const, releve: "Relevé il y a 12 min" },
  { nom: "Routeur — Relais marché", cpu: "—", ram: "—", statut: "critique" as const, releve: "Dernier relevé réussi hier" },
];

function BadgeStatut({ statut }: { statut: "ok" | "majeur" | "critique" }) {
  if (statut === "critique") {
    return (
      <Badge variant="destructive">
        <Pastille classe="bg-status-critique" />1 critique
      </Badge>
    );
  }
  if (statut === "majeur") {
    return (
      <Badge variant="outline" className="border-status-majeur/30 bg-status-majeur/10 text-status-majeur">
        <Pastille classe="bg-status-majeur" />1 majeur
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Pastille classe="bg-status-ok" />
      Sous contrôle
    </Badge>
  );
}

// Le ticket, objet central du produit : encoches et pointilles de decoupe.
export function TicketExemple({ code, duree, classe }: { code: string; duree: string; classe: string }) {
  return (
    <div
      className={`w-full max-w-60 rounded-lg bg-card text-card-foreground shadow-md ring-1 ring-foreground/10 ${classe}`}
      style={{
        mask: "radial-gradient(circle 8px at 0 66%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 8px at 100% 66%, transparent 98%, #000) right / 51% 100% no-repeat",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        <span>Wi-Fi Hotspot</span>
        <span>{duree}</span>
      </div>
      <p className="px-4 pt-1 pb-4 font-mono text-2xl font-semibold tracking-wider">{code}</p>
      <div className="border-t border-dashed px-4 py-2 text-[10px] text-muted-foreground">
        Identifiant = mot de passe
      </div>
    </div>
  );
}

export function ApercuProduit() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity aria-hidden="true" className="text-muted-foreground" />
                Parc de routeurs
              </CardTitle>
              <CardDescription>Exemple fictif — forme du tableau de bord réel.</CardDescription>
            </div>
            <Badge variant="outline">Aperçu</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-3 divide-x rounded-lg border">
            <div className="flex flex-col items-center gap-0.5 px-2 py-3">
              <span className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <Pastille classe="bg-status-critique" />1
              </span>
              <span className="text-xs text-muted-foreground">critique</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2 py-3">
              <span className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <Pastille classe="bg-status-majeur" />1
              </span>
              <span className="text-xs text-muted-foreground">majeur</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2 py-3">
              <span className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <Pastille classe="bg-status-ok" />1
              </span>
              <span className="text-xs text-muted-foreground">sous contrôle</span>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {ROUTEURS_EXEMPLE.map((r) => (
              <li key={r.nom} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.nom}</span>
                  <BadgeStatut statut={r.statut} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Cpu aria-hidden="true" className="size-3.5" /> CPU {r.cpu}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MemoryStick aria-hidden="true" className="size-3.5" /> RAM {r.ram}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Wifi aria-hidden="true" className="size-3.5" /> {r.releve}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <span className="text-xs text-muted-foreground">Constats classés par gravité, date du dernier relevé réussi toujours visible.</span>
        </CardFooter>
      </Card>

      <div aria-label="Exemple de tickets Hotspot, codes fictifs" role="img" className="relative hidden h-44 sm:block">
        <TicketExemple code="10j48372" duree="10 jours" classe="flottement-ticket absolute top-0 left-2 -rotate-3" />
        <TicketExemple code="1j638291" duree="1 jour" classe="flottement-ticket flottement-ticket-retard absolute top-14 right-2 rotate-2" />
      </div>
      <Separator className="sm:hidden" />
      <p className="text-center text-xs text-muted-foreground sm:hidden">Tickets fictifs — identifiant identique au mot de passe, format Mikhmon.</p>
    </div>
  );
}
