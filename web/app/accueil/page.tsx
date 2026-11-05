import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono } from "next/font/google";
import {
  Activity,
  ArrowRight,
  Check,
  Eye,
  FileCheck2,
  KeyRound,
  Lock,
  Router,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EnTeteAccueil } from "@/components/landing/en-tete-accueil";
import { ApercuProduit } from "@/components/landing/apercu-produit";
import { RouteurMikrotik3D } from "@/components/landing/routeur-mikrotik-3d";
import { Illustration3D } from "@/components/landing/illustration-3d";
import { Revelation } from "@/components/landing/revelation";
import {
  CanauxTabs,
  FaqAccueil,
  FonctionnementTabs,
} from "@/components/landing/sections-interactives";

// Page publique : presente les fonctions reelles du produit avec les
// composants shadcn/ui. L'apercu du hero est un exemple fictif, signale
// comme tel, sans chiffre ni client invente.
const codes = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-codes",
});

export const metadata: Metadata = {
  title: "SafeLink Auto-Pilot — Vos routeurs MikroTik et vos tickets Hotspot, sous contrôle",
  description:
    "Surveillez vos routeurs MikroTik, corrigez la configuration après validation et générez vos tickets Hotspot automatiquement.",
};

const GARANTIES_HERO = [
  "Diagnostic matériel, Wi-Fi, ports et configuration",
  "Correctifs seulement après sauvegarde et validation",
  "Tickets Mikhmon générés avant la rupture de stock",
] as const;

const GARANTIES_BANDEAU = [
  { icone: Eye, titre: "Lecture seule pour surveiller", texte: "Le diagnostic ne peut rien casser : compte dédié sans droit d'écriture." },
  { icone: Wrench, titre: "Écriture seulement validée", texte: "Sauvegarde, plan lisible, validation humaine. Rien d'automatique sur le routeur." },
  { icone: ShieldCheck, titre: "Jamais de suppression", texte: "Un objet à retirer est désactivé (disabled=yes), jamais supprimé." },
  { icone: KeyRound, titre: "Mots de passe jamais stockés", texte: "Ceux des tickets vivent dans le routeur, pas en base ni dans les journaux." },
] as const;

function TitreSection({
  id,
  surtitre,
  titre,
  texte,
}: {
  id: string;
  surtitre: string;
  titre: string;
  texte?: string;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <Badge className="w-fit border-transparent bg-accent font-mono text-[11px] tracking-[0.14em] text-accent-foreground uppercase">
        {surtitre}
      </Badge>
      <h2 id={id} className="text-balance font-[family-name:var(--font-titres)] text-4xl font-medium tracking-tight">
        {titre}
      </h2>
      {texte ? <p className="leading-relaxed text-muted-foreground">{texte}</p> : null}
    </div>
  );
}

export default function PageAccueil() {
  return (
    <div className={`${codes.variable} bg-background`}>
      <EnTeteAccueil />

      {/* Hero */}
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <svg
          aria-hidden="true"
          viewBox="0 0 800 800"
          className="hero-ondes pointer-events-none absolute -top-40 -right-48 size-[52rem] opacity-[0.13]"
          fill="none"
          stroke="currentColor"
        >
          {[120, 200, 280, 360, 440, 520].map((r) => (
            <circle key={r} cx="400" cy="400" r={r} strokeWidth="1.5" />
          ))}
        </svg>
        <span
          aria-hidden="true"
          className="halo-wifi pointer-events-none absolute top-28 right-[16%] hidden size-24 rounded-full border-2 border-status-ok/40 lg:block"
        />
        <span
          aria-hidden="true"
          className="halo-wifi halo-wifi-retard pointer-events-none absolute top-28 right-[16%] hidden size-24 rounded-full border-2 border-status-ok/40 lg:block"
        />
        <div className="relative mx-auto grid max-w-6xl items-start gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20 lg:pb-24">
          <div>
            <Badge className="border-transparent bg-accent font-mono text-[11px] tracking-[0.14em] text-accent-foreground uppercase">
              Routeurs MikroTik · Tickets Hotspot
            </Badge>
            <h1 className="mt-5 text-balance font-[family-name:var(--font-titres)] text-5xl leading-[1.02] font-medium tracking-tight sm:text-6xl">
              Votre réseau tourne. Vos tickets ne manquent plus.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed opacity-80">
              SafeLink surveille vos routeurs, signale ce qui ne va pas et recrée vos tickets Wi-Fi avant la rupture de stock — sans jamais écrire sur le routeur sans votre accord.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/85">
                <Link href="/connexion">
                  Accéder à mon espace
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <a href="#fonctionnement">Voir comment ça marche</a>
              </Button>
            </div>
            <ul className="mt-8 flex flex-col gap-2.5">
              {GARANTIES_HERO.map((g) => (
                <li key={g} className="flex items-start gap-2.5 text-sm opacity-85">
                  <Check aria-hidden="true" className="mt-0.5 shrink-0 text-status-ok" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-5">
            <RouteurMikrotik3D />
            <ApercuProduit />
          </div>
        </div>
      </section>

      {/* Bandeau garanties */}
      <section aria-label="Garanties de sécurité" className="border-b">
        <div className="mx-auto grid max-w-6xl gap-px px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {GARANTIES_BANDEAU.map((g, i) => {
            const Icone = g.icone;
            return (
              <Revelation key={g.titre} delai={i * 90} classe="flex flex-col gap-2 px-2 py-3 transition-colors duration-300 hover:bg-secondary/60 sm:px-5">
                <span className="flex items-center gap-2 font-medium">
                  <Icone aria-hidden="true" className="text-muted-foreground" />
                  {g.titre}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{g.texte}</span>
              </Revelation>
            );
          })}
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" aria-labelledby="titre-fonctionnement" className="scroll-mt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_360px]">
            <TitreSection
              id="titre-fonctionnement"
              surtitre="Réapprovisionnement automatique"
              titre="Le stock baisse, le lot suivant est déjà en route."
              texte="Choisissez un seuil et une fréquence par profil. SafeLink surveille, génère, met en page et livre — vous ne touchez à rien tant que le stock est sain."
            />
            <Illustration3D
              variante="stock"
              titre="Illustration 3D du stock de tickets en réapprovisionnement"
              legende="Stock de tickets surveillé en continu"
            />
          </div>
          <Revelation>
            <FonctionnementTabs />
          </Revelation>
        </div>
      </section>

      <Separator />

      {/* Fonctions */}
      <section id="fonctions" aria-labelledby="titre-fonctions" className="scroll-mt-20 bg-secondary/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_360px]">
            <TitreSection
              id="titre-fonctions"
              surtitre="Fonctions"
              titre="Tout le parc, au même endroit."
              texte="Un seul écran pour l'état de vos routeurs et vos tickets. Les constats sont classés par gravité, et la date du dernier relevé réussi reste toujours visible."
            />
            <Illustration3D
              variante="diagnostic"
              titre="Illustration 3D du diagnostic des routeurs"
              legende="Signal, CPU, RAM et ports suivis en direct"
            />
          </div>
          <Revelation>
          <div className="grid gap-4 lg:grid-cols-6">
            <Card className="bg-sidebar text-sidebar-foreground transition-shadow duration-300 hover:shadow-lg lg:col-span-4">
              <CardHeader>
                <Activity aria-hidden="true" className="opacity-80" />
                <CardTitle className="font-[family-name:var(--font-titres)] text-3xl font-medium">Diagnostic du routeur</CardTitle>
                <CardDescription className="max-w-xl leading-relaxed text-sidebar-foreground/75">
                  Modèle, CPU et RAM en direct, plus l&apos;état du matériel, du Wi-Fi, des ports et de la configuration. Vous savez ce qui cloche avant que vos clients ne le remarquent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {["matériel", "wi-fi", "ports", "audit de configuration"].map((t) => (
                    <li key={t}>
                      <Badge variant="outline" className="border-sidebar-border font-mono text-xs text-sidebar-foreground">
                        {t}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/75">
                Constats ouverts comptés en critiques et majeurs, routeur par routeur.
              </CardFooter>
            </Card>

            <Card className="transition-shadow duration-300 hover:shadow-md lg:col-span-2">
              <CardHeader>
                <Wrench aria-hidden="true" className="text-muted-foreground" />
                <CardTitle className="font-[family-name:var(--font-titres)] text-2xl font-medium">Correctifs validés</CardTitle>
                <CardDescription className="leading-relaxed">
                  Sauvegarde, plan clair et validation humaine avant toute écriture sur le routeur. Rien ne s&apos;applique tout seul.
                </CardDescription>
              </CardHeader>
              <CardFooter>Compte d&apos;écriture séparé du compte de lecture.</CardFooter>
            </Card>

            <Card className="transition-shadow duration-300 hover:shadow-md lg:col-span-2">
              <CardHeader>
                <Ticket aria-hidden="true" className="text-muted-foreground" />
                <CardTitle className="font-[family-name:var(--font-titres)] text-2xl font-medium">Tickets compatibles Mikhmon</CardTitle>
                <CardDescription className="leading-relaxed">
                  Préfixe du profil, code de 8 caractères, identifiant identique au mot de passe et commentaire reconnu par Mikhmon.
                </CardDescription>
              </CardHeader>
              <CardFooter>Profils Hotspot repris tels quels, sans ressaisie.</CardFooter>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <Lock aria-hidden="true" className="text-muted-foreground" />
                <CardTitle className="font-[family-name:var(--font-titres)] text-2xl font-medium">Des comptes séparés et des secrets protégés</CardTitle>
                <CardDescription className="max-w-xl leading-relaxed">
                  Un compte de lecture pour surveiller, un autre pour écrire. Les accès sont chiffrés, et les mots de passe des tickets restent dans le routeur, pas dans la base de l&apos;application.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Lecture seule (ROUTEROS_USER)</Badge>
                  <Badge variant="secondary">Écriture validée (ROUTEROS_FIX_USER)</Badge>
                  <Badge variant="secondary">Aucun secret côté navigateur</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
          </Revelation>
        </div>
      </section>

      {/* Canaux */}
      <section id="canaux" aria-labelledby="titre-canaux" className="scroll-mt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_360px]">
            <TitreSection
              id="titre-canaux"
              surtitre="Livraison"
              titre="Le PDF part là où vous en avez besoin."
              texte="Le même lot peut partir sur plusieurs canaux à la fois, et chez d'autres destinataires que vous. Choisissez par règle, changez quand vous voulez."
            />
            <Illustration3D
              variante="canaux"
              titre="Illustration 3D de la livraison du PDF vers Telegram, WhatsApp et l'impression"
              legende="Un PDF, plusieurs destinations"
            />
          </div>
          <Revelation>
            <CanauxTabs />
          </Revelation>
        </div>
      </section>

      <Separator />

      {/* Sécurité */}
      <section id="securite" aria-labelledby="titre-securite" className="scroll-mt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_360px]">
            <TitreSection
              id="titre-securite"
              surtitre="Sécurité"
              titre="Ce qui est automatisé, et ce qui ne le sera jamais."
              texte="La frontière est écrite dans le produit, pas seulement promise. Voici exactement où elle passe."
            />
            <Illustration3D
              variante="securite"
              titre="Illustration 3D de la sécurité : bouclier et cadenas"
              legende="Lecture seule, écriture seulement validée"
            />
          </div>
          <Revelation>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck aria-hidden="true" className="text-status-ok" />
                  Automatisé, sous vos règles
                </CardTitle>
                <CardDescription>Ce que SafeLink a le droit de faire sans vous déranger.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3 text-sm leading-relaxed">
                  {[
                    "Lire l'état du routeur avec le compte de lecture seule",
                    "Compter le stock de tickets neufs et comparer au seuil",
                    "Générer un lot après simulation, selon votre règle",
                    "Produire le PDF et le livrer sur vos canaux",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check aria-hidden="true" className="mt-0.5 shrink-0 text-status-ok" />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Lock aria-hidden="true" className="text-status-critique" />
                  Proposé, jamais appliqué seul
                </CardTitle>
                <CardDescription>Ce que SafeLink signale, mais ne touche pas sans vous.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3 text-sm leading-relaxed">
                  {[
                    "Les règles input du pare-feu",
                    "Les services (/ip/service) et leurs ports",
                    "L'adressage IP et les routes",
                    "Toute suppression : on désactive, on ne supprime pas",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Lock aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          </Revelation>
          <Alert>
            <Router aria-hidden="true" />
            <AlertTitle>Une sauvegarde précède chaque écriture</AlertTitle>
            <AlertDescription>
              Avant le moindre correctif appliqué, le routeur est sauvegardé et le plan vous est présenté. Si vous refusez, rien ne change sur le routeur.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      <Separator />

      {/* Pour qui */}
      <section aria-labelledby="titre-profils" className="bg-secondary/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_360px]">
            <TitreSection
              id="titre-profils"
              surtitre="Pour qui"
              titre="Pensé pour ceux qui vendent du Wi-Fi au quotidien."
            />
            <Illustration3D
              variante="publics"
              titre="Illustration 3D des utilisateurs : gérant, revendeur et technicien"
              legende="Gérant, revendeur et technicien connectés"
            />
          </div>
          <Revelation>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>G</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg">Gérant de hotspot</CardTitle>
                </div>
                <CardDescription className="leading-relaxed">
                  Vous ne voulez plus découvrir la rupture de stock quand un client est déjà devant vous.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Le réapprovisionnement veille pendant que vous faites autre chose, et le diagnostic vous dit quel routeur fatigue.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>R</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg">Revendeur de tickets</CardTitle>
                </div>
                <CardDescription className="leading-relaxed">
                  Vous recevez la planche prête à découper, sur le canal que vous lisez déjà.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Telegram, WhatsApp ou impression directe : le PDF arrive sans que le gérant ait à vous le renvoyer à la main.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>T</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg">Technicien réseau</CardTitle>
                </div>
                <CardDescription className="leading-relaxed">
                  Vous gardez la main : lecture seule par défaut, écriture seulement après votre validation.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Users aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  Plusieurs routeurs, un seul parc, des constats classés par gravité.
                </span>
              </CardContent>
            </Card>
          </div>
          </Revelation>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="titre-faq" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
          <TitreSection
            id="titre-faq"
            surtitre="Questions fréquentes"
            titre="Ce qu'on nous demande avant de commencer."
            texte="Une autre question ? Connectez-vous et posez-la depuis votre espace, ou reparcourez les fonctions ci-dessus."
          />
          <Revelation>
            <FaqAccueil />
          </Revelation>
        </div>
      </section>

      {/* Appel final */}
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-20">
          <div className="flex max-w-2xl flex-col gap-4">
            <Badge variant="secondary" className="w-fit font-mono text-[11px] tracking-[0.14em] uppercase">
              <FileCheck2 data-icon="inline-start" aria-hidden="true" />
              Simulation avant génération
            </Badge>
            <h2 className="text-balance font-[family-name:var(--font-titres)] text-4xl font-medium tracking-tight">
              Reprenez la main sur vos routeurs dès aujourd&apos;hui.
            </h2>
            <p className="leading-relaxed opacity-80">
              Ajoutez votre premier routeur en lecture seule, lancez un diagnostic, puis décidez. Rien ne sera écrit sans votre validation.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="w-fit shrink-0">
            <Link href="/connexion">
              Accéder à mon espace
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="bg-sidebar text-sidebar-foreground">
        <Separator className="bg-sidebar-border" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              SafeLink <span className="font-normal opacity-65">Auto-Pilot</span>
            </span>
            <nav aria-label="Liens de pied de page" className="flex flex-wrap gap-2">
              {[
                { href: "#fonctionnement", titre: "Fonctionnement" },
                { href: "#fonctions", titre: "Fonctions" },
                { href: "#securite", titre: "Sécurité" },
                { href: "/connexion", titre: "Se connecter" },
              ].map((l) => (
                <Button
                  key={l.titre}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  {l.href.startsWith("#") ? <a href={l.href}>{l.titre}</a> : <Link href={l.href}>{l.titre}</Link>}
                </Button>
              ))}
            </nav>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed opacity-65">
            Surveillance MikroTik (matériel, Wi-Fi, ports, audit de configuration), correctifs de configuration après validation humaine, et génération de tickets Hotspot compatibles Mikhmon. Les mots de passe des tickets restent dans le routeur.
          </p>
        </div>
      </footer>
    </div>
  );
}
