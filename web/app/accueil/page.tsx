import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import {
  Activity,
  ArrowRight,
  FileCheck2,
  MessageCircle,
  Printer,
  Repeat,
  Send,
  ShieldCheck,
  Ticket,
  Wifi,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Page publique : presente les fonctions reelles du produit. L'apercu du hero
// est un exemple fictif, signale comme tel, sans chiffre ni client invente.
const titres = Fraunces({ subsets: ["latin"], variable: "--font-titres" });
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

const ETAPES = [
  { titre: "Surveille", texte: "Le stock de tickets neufs est contrôlé selon votre fréquence." },
  { titre: "Génère", texte: "Sous le seuil, un lot est créé directement sur le routeur." },
  { titre: "Met en page", texte: "Les tickets partent dans un PDF prêt à découper." },
  { titre: "Livre", texte: "Le PDF arrive sur le bon canal, sans manipulation." },
];

const CANAUX = [
  { icone: Send, nom: "Telegram", texte: "Le PDF arrive dans votre discussion, et chez vos autres destinataires." },
  { icone: MessageCircle, nom: "WhatsApp", texte: "Envoi par votre adaptateur vers un ou plusieurs numéros." },
  { icone: Printer, nom: "PrintNode", texte: "Impression sur votre imprimante depuis un Raspberry Pi, un Mac ou un PC." },
  { icone: FileCheck2, nom: "PDF", texte: "Un format de planche prêt à découper pour vos revendeurs." },
];

function Marque({ clair = false }: { clair?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Wifi aria-hidden="true" className="size-5" />
      <span className="text-sm font-semibold tracking-tight">
        SafeLink <span className={clair ? "font-normal opacity-65" : "font-normal text-muted-foreground"}>Auto-Pilot</span>
      </span>
    </span>
  );
}

function Actions({ clair = false }: { clair?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        asChild
        size="lg"
        className={clair ? "bg-[oklch(0.96_0.018_90)] text-sidebar hover:bg-white" : undefined}
      >
        <Link href="/connexion">
          Accéder à mon espace <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <a
        href="#fonctions"
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        Voir les fonctions
      </a>
    </div>
  );
}

// Le ticket, objet central du produit : encoches et pointilles de decoupe.
function TicketExemple({ code, duree, classe }: { code: string; duree: string; classe: string }) {
  return (
    <div
      className={`w-56 rounded-lg bg-[oklch(0.99_0.006_90)] text-sidebar shadow-xl ${classe}`}
      style={{
        mask: "radial-gradient(circle 8px at 0 66%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 8px at 100% 66%, transparent 98%, #000) right / 51% 100% no-repeat",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
        <span>Wi-Fi Hotspot</span>
        <span>{duree}</span>
      </div>
      <p className="px-4 pb-4 pt-1 font-[family-name:var(--font-codes)] text-2xl font-semibold tracking-wider">
        {code}
      </p>
      <div className="border-t border-dashed border-sidebar/30 px-4 py-2 text-[10px] opacity-70">
        Identifiant = mot de passe
      </div>
    </div>
  );
}

export default function PageAccueil() {
  return (
    <div className={`${titres.variable} ${codes.variable} bg-background`}>
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        {/* Arcs de signal : le motif de la marque, a l'echelle du hero. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 800"
          className="pointer-events-none absolute -right-48 -top-40 size-[52rem] opacity-[0.14]"
          fill="none"
          stroke="currentColor"
        >
          {[120, 200, 280, 360, 440, 520].map((r) => (
            <circle key={r} cx="400" cy="400" r={r} strokeWidth="1.5" />
          ))}
        </svg>
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:pb-24">
          <header className="flex items-center justify-between gap-3">
            <Marque clair />
            <Link href="/connexion" className="text-sm font-medium underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </header>
          <div className="mt-14 grid items-center gap-12 lg:mt-20 lg:grid-cols-[1.25fr_1fr]">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
              <p className="font-[family-name:var(--font-codes)] text-xs uppercase tracking-[0.18em] opacity-70">
                Routeurs MikroTik · Tickets Hotspot
              </p>
              <h1 className="mt-4 text-balance font-[family-name:var(--font-titres)] text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                Votre réseau tourne. Vos tickets ne manquent plus.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed opacity-80">
                SafeLink surveille vos routeurs, signale ce qui ne va pas et
                recrée vos tickets Wi-Fi avant la rupture de stock.
              </p>
              <div className="mt-8">
                <Actions clair />
              </div>
            </div>
            <div
              aria-label="Exemple de tickets Hotspot, codes fictifs"
              role="img"
              className="relative mx-auto h-72 w-full max-w-sm animate-in fade-in zoom-in-95 delay-200 duration-700 fill-mode-both motion-reduce:animate-none"
            >
              <TicketExemple code="10j48372" duree="10 jours" classe="absolute left-2 top-2 -rotate-6" />
              <TicketExemple code="5j927364" duree="5 jours" classe="absolute right-0 top-20 rotate-3" />
              <TicketExemple code="1j638291" duree="1 jour" classe="absolute bottom-0 left-8 -rotate-2" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-boucle" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id="titre-boucle" className="max-w-2xl text-balance font-[family-name:var(--font-titres)] text-4xl font-medium tracking-tight">
          Le stock baisse, le lot suivant est déjà en route.
        </h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map((e, i) => (
            <li key={e.titre} className="bg-card p-6">
              <span className="font-[family-name:var(--font-codes)] text-xs text-muted-foreground">
                0{i + 1}
              </span>
              <h3 className="mt-3 font-[family-name:var(--font-titres)] text-2xl">{e.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.texte}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
          <Repeat aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Chaque règle garde son seuil, sa quantité et sa fréquence, et passe par
          une simulation avant toute génération réelle.
        </p>
      </section>

      <section id="fonctions" aria-labelledby="titre-fonctions" className="scroll-mt-6 border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 id="titre-fonctions" className="font-[family-name:var(--font-titres)] text-4xl font-medium tracking-tight">
            Tout le parc, au même endroit.
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-6">
            <article className="rounded-xl bg-sidebar p-7 text-sidebar-foreground lg:col-span-4">
              <Activity aria-hidden="true" className="size-6" />
              <h3 className="mt-5 font-[family-name:var(--font-titres)] text-3xl">
                Diagnostic du routeur
              </h3>
              <p className="mt-3 max-w-xl leading-relaxed opacity-80">
                Modèle, CPU et RAM en direct, plus l&apos;état du matériel, du
                Wi-Fi, des ports et de la configuration. Les constats sont
                classés par gravité.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2 font-[family-name:var(--font-codes)] text-xs">
                {["matériel", "wi-fi", "ports", "audit de configuration"].map((t) => (
                  <li key={t} className="rounded-full border border-sidebar-border px-3 py-1">{t}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border bg-card p-7 lg:col-span-2">
              <Wrench aria-hidden="true" className="size-6" />
              <h3 className="mt-5 font-[family-name:var(--font-titres)] text-2xl">
                Correctifs validés
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Sauvegarde, plan clair et validation humaine avant toute
                écriture sur le routeur.
              </p>
            </article>
            <article className="rounded-xl border bg-card p-7 lg:col-span-2">
              <Ticket aria-hidden="true" className="size-6" />
              <h3 className="mt-5 font-[family-name:var(--font-titres)] text-2xl">
                Tickets compatibles Mikhmon
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Préfixe du profil, code de 8 caractères, identifiant identique au
                mot de passe et commentaire reconnu par Mikhmon.
              </p>
            </article>
            <article className="rounded-xl border bg-card p-7 lg:col-span-4">
              <ShieldCheck aria-hidden="true" className="size-6" />
              <h3 className="mt-5 font-[family-name:var(--font-titres)] text-2xl">
                Des comptes séparés et des secrets protégés
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Un compte de lecture pour surveiller, un autre pour écrire. Les
                accès sont chiffrés, et les mots de passe des tickets restent
                dans le routeur, pas dans la base de l&apos;application.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-canaux" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id="titre-canaux" className="max-w-2xl text-balance font-[family-name:var(--font-titres)] text-4xl font-medium tracking-tight">
          Le PDF part là où vous en avez besoin.
        </h2>
        <ul className="mt-10 divide-y border-y">
          {CANAUX.map(({ icone: Icone, nom, texte }) => (
            <li key={nom} className="grid gap-2 py-5 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="flex items-center gap-3 font-[family-name:var(--font-titres)] text-xl">
                <Icone aria-hidden="true" className="size-5" />
                {nom}
              </span>
              <span className="text-muted-foreground">{texte}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-2xl text-balance font-[family-name:var(--font-titres)] text-4xl font-medium tracking-tight">
            Reprenez la main sur vos routeurs dès aujourd&apos;hui.
          </h2>
          <Button
            asChild
            size="lg"
            className="w-fit bg-[oklch(0.96_0.018_90)] text-sidebar hover:bg-white"
          >
            <Link href="/connexion">
              Accéder à mon espace <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
