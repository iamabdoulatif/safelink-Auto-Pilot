"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Navigation laterale : les 12 rubriques regroupees par theme.
// Fixe a gauche sur ecran large, tiroir sur mobile. Le lien actif est
// en pilule : on sait toujours ou l'on est.
type Lien = { href: string; titre: string; icone: typeof Menu };
type Groupe = { nom: string; liens: Lien[] };

const GROUPES: Groupe[] = [
  {
    nom: "Parc",
    liens: [
      { href: "/", titre: "Tableau de bord", icone: LayoutDashboard },
      { href: "/diagnostics", titre: "Diagnostics", icone: Activity },
    ],
  },
  {
    nom: "Tickets",
    liens: [
      { href: "/tickets/nouveau", titre: "Générer des tickets", icone: Ticket },
      {
        href: "/reapprovisionnement",
        titre: "Réapprovisionnement automatique",
        icone: Repeat,
      },
      { href: "/profils-hotspot", titre: "Profils Hotspot", icone: LayoutGrid },
      { href: "/historique", titre: "Historique", icone: History },
      {
        href: "/tickets/approbations",
        titre: "Approbations",
        icone: ClipboardCheck,
      },
    ],
  },
  {
    nom: "Connexions",
    liens: [
      {
        href: "/connexions-mikhmon",
        titre: "Mes connexions Mikhmon",
        icone: Radio,
      },
      { href: "/routeurs", titre: "Mes routeurs", icone: Router },
    ],
  },
  {
    nom: "Notifications",
    liens: [
      {
        href: "/configuration/telegram",
        titre: "Configuration Telegram",
        icone: Send,
      },
      {
        href: "/configuration/whatsapp",
        titre: "Configuration WhatsApp",
        icone: MessageCircle,
      },
      {
        href: "/configuration/printnode",
        titre: "Configuration PrintNode",
        icone: Printer,
      },
    ],
  },
  {
    nom: "Compte",
    liens: [
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
          liens: [{ href: "/admin/utilisateurs", titre: "Utilisateurs", icone: ShieldCheck }],
        },
      ]
    : GROUPES;
  return (
    <div className="flex flex-col gap-4">
      {groupes.map((g) => (
        <div key={g.nom} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-xs font-medium text-sidebar-foreground/55">
            {g.nom}
          </p>
          <ul className="flex flex-col gap-0.5">
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
        </div>
      ))}
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
        <nav aria-label="Navigation principale" className="flex-1">
          <ListeLiens chemin={chemin} superAdmin={superAdmin} />
        </nav>
      </aside>
    </>
  );
}
