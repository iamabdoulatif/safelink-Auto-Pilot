"use client";

import Link from "next/link";
import { ArrowRight, Menu, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

// En-tete publique : fixe en haut, navigation par ancres sur bureau,
// tiroir Sheet sur mobile. Aucun menu de l'application ici.
const LIENS = [
  { href: "#fonctionnement", titre: "Fonctionnement" },
  { href: "#fonctions", titre: "Fonctions" },
  { href: "#canaux", titre: "Canaux" },
  { href: "#securite", titre: "Sécurité" },
  { href: "#faq", titre: "FAQ" },
] as const;

function Marque() {
  return (
    <Link href="/accueil" className="flex items-center gap-2" aria-label="SafeLink Auto-Pilot — accueil">
      <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-foreground text-sidebar">
        <Wifi aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold tracking-tight">
        SafeLink <span className="font-normal opacity-65">Auto-Pilot</span>
      </span>
    </Link>
  );
}

export function EnTeteAccueil() {
  return (
    <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar/95 text-sidebar-foreground backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Marque />
        <nav aria-label="Navigation de la page" className="hidden items-center gap-1 lg:flex">
          {LIENS.map((l) => (
            <Button
              key={l.href}
              asChild
              variant="ghost"
              size="sm"
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <a href={l.href}>{l.titre}</a>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:inline-flex"
          >
            <Link href="/connexion">Se connecter</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/connexion">
              Accéder à mon espace
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ouvrir le menu"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-72 flex-col gap-4 border-sidebar-border bg-sidebar text-sidebar-foreground"
            >
              <SheetTitle className="flex items-center pr-8">
                <Marque />
              </SheetTitle>
              <Separator className="bg-sidebar-border" />
              <nav aria-label="Navigation mobile" className="flex flex-col gap-1">
                {LIENS.map((l) => (
                  <SheetClose key={l.href} asChild>
                    <a
                      href={l.href}
                      className="rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      {l.titre}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <Separator className="bg-sidebar-border" />
              <SheetClose asChild>
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/connexion">
                    Accéder à mon espace
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
              </SheetClose>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
