"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronDown,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Printer,
  Radio,
  Repeat,
  Router,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SelecteurEspace } from "@/components/selecteur-espace";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Navigation laterale : les rubriques classees par groupe metier,
// repliables pour aerer le tableau de bord. Fixe a gauche sur ecran
// large, tiroir sur mobile. Le lien actif est en pilule : on sait
// toujours ou l'on est, et son groupe reste ouvert.
type Lien = { href: string; titre: string; icone: typeof Menu };
type Groupe = { nom: string; liens: Lien[] };

const GROUPES: Groupe[] = [
  {
    nom: "Pilotage",
    liens: [
      { href: "/", titre: "Tableau de bord", icone: LayoutDashboard },
      { href: "/diagnostics", titre: "Diagnostics", icone: Activity },
      { href: "/historique", titre: "Historique", icone: History },
    ],
  },
  {
    nom: "Tickets",
    liens: [
      { href: "/tickets/nouveau", titre: "Générer des tickets", icone: Ticket },
      {
        href: "/tickets/approbations",
        titre: "Approbations",
        icone: ClipboardCheck,
      },
      { href: "/profils-hotspot", titre: "Profils Hotspot", icone: LayoutGrid },
      {
        href: "/reapprovisionnement",
        titre: "Réapprovisionnement automatique",
        icone: Repeat,
      },
    ],
  },
  {
    nom: "Routeurs",
    liens: [
      { href: "/routeurs", titre: "Mes routeurs", icone: Router },
      {
        href: "/connexions-mikhmon",
        titre: "Connexions Mikhmon",
        icone: Radio,
      },
      {
        href: "/configuration/routeur",
        titre: "Configuration routeur",
        icone: Wrench,
      },
    ],
  },
  {
    nom: "Canaux de livraison",
    liens: [
      { href: "/configuration/telegram", titre: "Telegram", icone: Send },
      { href: "/configuration/whatsapp", titre: "WhatsApp", icone: MessageCircle },
      { href: "/configuration/printnode", titre: "PrintNode", icone: Printer },
    ],
  },
  {
    nom: "Espace",
    liens: [
      { href: "/membres", titre: "Membres et rôles", icone: Users },
      { href: "/profil", titre: "Mon profil", icone: UserRound },
      { href: "/parametres", titre: "Paramètres du compte", icone: Settings },
      { href: "/deconnexion", titre: "Déconnexion", icone: LogOut },
    ],
  },
];

// Marque « signal » : trois arcs concentriques, l'outil parle radio.
function Marque() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx={8} cy={12.5} r={1.3} fill="currentColor" stroke="none" />
      <path d="M4.8 9.3a4.5 4.5 0 0 1 6.4 0" />
      <path d="M2.6 7.1a7.6 7.6 0 0 1 10.8 0" />
      <path d="M0.5 5A10.6 10.6 0 0 1 15.5 5" />
    </svg>
  );
}

function Nom() {
  return (
    <Link href="/accueil" className="flex items-center gap-2" aria-label="SafeLink Auto-Pilot — page de présentation">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Marque />
      </span>
      <span className="text-sm font-semibold tracking-tight">
        SafeLink{" "}
        <span className="font-normal opacity-65">Auto-Pilot</span>
      </span>
    </Link>
  );
}

function ListeLiens({
  chemin,
  fermer,
  superAdmin = false,
}: {
  chemin: string;
  fermer?: boolean;
  superAdmin?: boolean;
}) {
  const actif = (href: string) =>
    href === "/" ? chemin === "/" : chemin === href || chemin.startsWith(href + "/");
  const groupes: Groupe[] = superAdmin
    ? [
        ...GROUPES,
        {
          nom: "Administration",
          liens: [
            { href: "/admin/utilisateurs", titre: "Utilisateurs", icone: ShieldCheck },
            { href: "/admin/parametres", titre: "Paramètres plateforme", icone: Settings },
          ],
        },
      ]
    : GROUPES;
  const groupeActif = groupes.find((g) => g.liens.some((l) => actif(l.href)))?.nom;
  // Groupes ouverts : celui de la page courante, plus ceux que
  // l'utilisateur déplie à la main. Les autres restent repliés.
  const [ouverts, setOuverts] = useState<ReadonlySet<string>>(
    () => new Set(groupeActif ? [groupeActif] : ["Pilotage"]),
  );
  // À chaque navigation, le groupe de la page courante se déplie :
  // ajustement pendant le rendu, sans effet.
  const [groupeActifVu, setGroupeActifVu] = useState(groupeActif);
  if (groupeActif !== groupeActifVu) {
    setGroupeActifVu(groupeActif);
    if (groupeActif && !ouverts.has(groupeActif)) {
      setOuverts(new Set([...ouverts, groupeActif]));
    }
  }
  const basculer = (nom: string) =>
    setOuverts((avant) => {
      const apres = new Set(avant);
      if (apres.has(nom)) apres.delete(nom);
      else apres.add(nom);
      return apres;
    });
  return (
    <div className="flex flex-col gap-1.5">
      {groupes.map((g) => {
        const ouvert = ouverts.has(g.nom);
        const contientActif = g.liens.some((l) => actif(l.href));
        return (
          <div key={g.nom} className="flex flex-col">
            <button
              type="button"
              onClick={() => basculer(g.nom)}
              aria-expanded={ouvert}
              className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors",
                contientActif
                  ? "text-sidebar-foreground"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <span>{g.nom}</span>
              <span className="flex items-center gap-1.5">
                {!ouvert && contientActif ? (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                ) : null}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    ouvert ? "" : "-rotate-90",
                  )}
                />
              </span>
            </button>
            {ouvert ? (
              <ul className="flex flex-col gap-0.5 pb-1.5">
                {g.liens.map((l) => {
                  const Icone = l.icone;
                  const lien = (
                    <Link
                      href={l.href}
                      aria-current={actif(l.href) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-all duration-200 hover:translate-x-0.5",
                        actif(l.href)
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icone aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{l.titre}</span>
                    </Link>
                  );
                  return (
                    <li key={l.href}>
                      {fermer ? (
                        <SheetClose asChild>{lien}</SheetClose>
                      ) : (
                        lien
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function NavPrincipale({ superAdmin = false }: { superAdmin?: boolean }) {
  const chemin = usePathname();
  return (
    <>
      {/* Barre mobile : marque + tiroir. */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar px-4 py-2.5 text-sidebar-foreground md:hidden">
        <Nom />
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ouvrir le menu"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-72 flex-col gap-4 border-sidebar-border bg-sidebar text-sidebar-foreground"
          >
            <SheetTitle className="flex items-center">
              <Nom />
            </SheetTitle>
            <SelecteurEspace />
            <div className="overflow-y-auto pb-4">
              <ListeLiens chemin={chemin} fermer superAdmin={superAdmin} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      {/* Barre laterale fixe sur ecran large. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
        <div className="px-2">
          <Nom />
        </div>
        <SelecteurEspace />
        <nav aria-label="Navigation principale" className="flex-1">
          <ListeLiens chemin={chemin} superAdmin={superAdmin} />
        </nav>
      </aside>
    </>
  );
}
