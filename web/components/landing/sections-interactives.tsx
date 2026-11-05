"use client";

import { useEffect, useRef, useState } from "react";

import {
  Eye,
  FileCheck2,
  Layers,
  MessageCircle,
  Printer,
  Repeat,
  Send,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

// Sections interactives de la page publique : onglets et accordéon.
// Ce sont les seuls îlots clients ; le reste de la page reste statique.

const ETAPES = [
  {
    valeur: "surveille",
    icone: Eye,
    titre: "Surveille",
    texte: "Le stock de tickets neufs de chaque profil est contrôlé selon la fréquence que vous avez choisie. Vous voyez le niveau restant avant qu'il ne devienne un problème.",
    points: [
      "Stock compté profil par profil, routeur par routeur",
      "Niveau visible dans le parc, avec la date du dernier relevé",
      "Rien n'est déclenché tant que le seuil n'est pas franchi",
    ],
    repere: { intitule: "Exemple de réglage", lignes: [["Seuil", "20 tickets neufs"], ["Contrôle", "toutes les 6 h"], ["Profils", "1 j · 7 j · 10 j"]] },
  },
  {
    valeur: "genere",
    icone: Sparkles,
    titre: "Génère",
    texte: "Sous le seuil, un lot est créé directement sur le routeur, au format Mikhmon : préfixe du profil, code de 8 caractères, identifiant identique au mot de passe.",
    points: [
      "Une simulation montre le lot avant la première génération réelle",
      "Création sur le routeur, dans vos profils Hotspot existants",
      "Quantité fixée par votre règle, pas par l'application",
    ],
    repere: { intitule: "Exemple de lot", lignes: [["Quantité", "50 tickets"], ["Format", "préfixe + 8 caractères"], ["Simulation", "obligatoire avant le réel"]] },
  },
  {
    valeur: "met-en-page",
    icone: Layers,
    titre: "Met en page",
    texte: "Les tickets du lot partent dans un PDF en planche, prêt à découper pour vos revendeurs. Pas de copier-coller, pas de mise en forme à refaire.",
    points: [
      "Planche au format de vos tickets actuels",
      "Le même PDF sert à l'envoi et à l'impression",
      "Lot retrouvé à tout moment dans l'historique",
    ],
    repere: { intitule: "Le document", lignes: [["Format", "PDF en planche"], ["Contenu", "codes du lot uniquement"], ["Mots de passe", "jamais stockés en base"]] },
  },
  {
    valeur: "livre",
    icone: Send,
    titre: "Livre",
    texte: "Le PDF arrive sur le canal choisi — Telegram, WhatsApp ou impression — et chez vos autres destinataires, sans manipulation supplémentaire.",
    points: [
      "Plusieurs canaux possibles pour un même lot",
      "Destinataires supplémentaires par règle",
      "Chaque envoi est tracé dans l'historique",
    ],
    repere: { intitule: "Exemple d'envoi", lignes: [["Canaux", "Telegram + impression"], ["Destinataires", "vous + 1 revendeur"], ["Trace", "horodatée dans l'historique"]] },
  },
] as const;

const DEROULE_TYPE = [
  { heure: "18:42", texte: "Le stock du profil 1 jour passe sous les 20 tickets." },
  { heure: "18:42", texte: "La simulation présente le lot qui serait créé." },
  { heure: "18:43", texte: "Lot de 50 tickets créé sur le routeur, au format Mikhmon." },
  { heure: "18:44", texte: "PDF livré sur Telegram et imprimé au bureau." },
] as const;

export function FonctionnementTabs() {
  // Les étapes défilent toutes seules, comme un produit qui tourne.
  // Au premier clic, la main revient à l'utilisateur pour de bon.
  const [valeur, setValeur] = useState<string>("surveille");
  const [auto, setAuto] = useState(true);
  const autoRef = useRef(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      autoRef.current = false;
      return;
    }
    const minuteur = setInterval(() => {
      if (!autoRef.current || document.hidden) return;
      setValeur((actuelle) => {
        const index = ETAPES.findIndex((e) => e.valeur === actuelle);
        return ETAPES[(index + 1) % ETAPES.length].valeur;
      });
    }, 4500);
    return () => clearInterval(minuteur);
  }, []);

  const choisir = (nouvelle: string) => {
    autoRef.current = false;
    setAuto(false);
    setValeur(nouvelle);
  };

  return (
    <div className="flex flex-col gap-10">
      <Tabs value={valeur} onValueChange={choisir} orientation="vertical" className="gap-8 lg:gap-14">
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-start gap-1 lg:w-64"
          aria-label="Étapes du réapprovisionnement automatique"
        >
          {ETAPES.map((e, i) => {
            const Icone = e.icone;
            return (
              <TabsTrigger
                key={e.valeur}
                value={e.valeur}
                className="justify-start gap-3 px-3 py-3 text-base"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground in-data-active:bg-accent in-data-active:text-accent-foreground">
                  0{i + 1}
                </span>
                <Icone aria-hidden="true" />
                {e.titre}
              </TabsTrigger>
            );
          })}
          <p className="mt-4 hidden px-3 text-sm leading-relaxed text-muted-foreground lg:block">
            Quatre étapes, toujours dans le même ordre. Cliquez sur une étape pour voir ce qui se passe concrètement.
          </p>
        </TabsList>
        {ETAPES.map((e) => {
          const Icone = e.icone;
          return (
            <TabsContent key={e.valeur} value={e.valeur}>
              <Card className="overflow-hidden">
                {auto ? (
                  <div aria-hidden="true" className="h-0.5 bg-secondary">
                    <div key={valeur} className="barre-progression h-full bg-accent" />
                  </div>
                ) : null}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Icone aria-hidden="true" className="text-muted-foreground" />
                    {e.titre}
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-base leading-relaxed">{e.texte}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
                    <ul className="flex flex-col gap-3">
                      {e.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed">
                          <Check aria-hidden="true" className="mt-0.5 shrink-0 text-status-ok" />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <aside className="h-fit rounded-lg bg-secondary/60 p-4">
                      <p className="text-sm font-semibold">{e.repere.intitule}</p>
                      <dl className="mt-3 flex flex-col gap-2.5">
                        {e.repere.lignes.map(([terme, valeur]) => (
                          <div key={terme} className="flex items-baseline justify-between gap-3 text-sm">
                            <dt className="text-muted-foreground">{terme}</dt>
                            <dd className="text-right font-medium">{valeur}</dd>
                          </div>
                        ))}
                      </dl>
                    </aside>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <section aria-labelledby="titre-deroule" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 id="titre-deroule" className="text-lg font-semibold">
            Un réapprovisionnement, minute par minute
          </h3>
          <Badge variant="secondary">Exemple fictif — déroulé type</Badge>
        </div>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DEROULE_TYPE.map((etape, i) => (
            <li key={etape.heure + etape.texte} className="relative flex flex-col gap-2 border-t-2 border-foreground/15 pt-4">
              <span
                aria-hidden="true"
                className="point-deroule absolute -top-[7px] left-0 size-3 rounded-full bg-accent ring-2 ring-background"
                style={{ animationDelay: `${i * 0.4}s` }}
              />
              <span className="font-mono text-sm font-semibold">{etape.heure}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                <span className="sr-only">Étape {i + 1} : </span>
                {etape.texte}
              </span>
            </li>
          ))}
        </ol>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Repeat aria-hidden="true" className="mt-0.5 shrink-0" />
          Les horaires sont illustratifs : en réel, tout dépend du seuil et de la fréquence de votre règle.
        </p>
      </section>
    </div>
  );
}

const CANAUX = [
  {
    valeur: "telegram",
    icone: Send,
    nom: "Telegram",
    texte: "Le PDF arrive dans votre discussion, et chez chaque destinataire ajouté. Idéal si votre équipe vit déjà sur Telegram.",
    point: "Bot configuré une fois, destinataires multiples ensuite.",
  },
  {
    valeur: "whatsapp",
    icone: MessageCircle,
    nom: "WhatsApp",
    texte: "Envoi par votre adaptateur vers un ou plusieurs numéros. Le revendeur reçoit la planche là où il lit déjà ses messages.",
    point: "Un ou plusieurs numéros par règle de réapprovisionnement.",
  },
  {
    valeur: "printnode",
    icone: Printer,
    nom: "PrintNode",
    texte: "Impression directe sur votre imprimante, depuis un Raspberry Pi, un Mac ou un PC. La planche sort sans ouvrir le PDF.",
    point: "Montages Raspberry Pi, Mac et PC documentés pas à pas.",
  },
  {
    valeur: "pdf",
    icone: FileCheck2,
    nom: "PDF à découper",
    texte: "Un format de planche prêt à découper pour vos revendeurs, téléchargeable aussi depuis l'historique à tout moment.",
    point: "Toujours disponible, même sans canal de messagerie.",
  },
] as const;

export function CanauxTabs() {
  return (
    <Tabs defaultValue="telegram" className="flex flex-col gap-6">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4" aria-label="Canaux de livraison du PDF">
        {CANAUX.map((c) => {
          const Icone = c.icone;
          return (
            <TabsTrigger key={c.valeur} value={c.valeur} className="gap-2">
              <Icone data-icon="inline-start" aria-hidden="true" />
              {c.nom}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {CANAUX.map((c) => {
        const Icone = c.icone;
        return (
          <TabsContent key={c.valeur} value={c.valeur}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Icone aria-hidden="true" className="text-muted-foreground" />
                  {c.nom}
                </CardTitle>
                <CardDescription className="max-w-2xl text-base leading-relaxed">{c.texte}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.point}</p>
              </CardContent>
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

const QUESTIONS = [
  {
    valeur: "mikrotik",
    question: "Faut-il un modèle MikroTik particulier ?",
    reponse:
      "Non. SafeLink parle à RouterOS 7 en REST via un compte dédié. Le diagnostic affiche le modèle, le CPU et la RAM dès que le routeur répond, quel que soit le modèle.",
  },
  {
    valeur: "ecriture",
    question: "L'application peut-elle modifier mon routeur toute seule ?",
    reponse:
      "Non. La surveillance utilise un compte en lecture seule. Toute écriture passe par un second compte, une sauvegarde préalable, un plan clair et votre validation. Les règles input du pare-feu, /ip/service, l'adressage IP et les routes ne sont jamais appliqués automatiquement : ils sont proposés, pas appliqués.",
  },
  {
    valeur: "mikhmon",
    question: "Les tickets sont-ils compatibles avec Mikhmon ?",
    reponse:
      "Oui. Préfixe du profil, code de 8 caractères, identifiant identique au mot de passe et commentaire reconnu par Mikhmon. Vous gardez vos habitudes de revente, SafeLink automatise seulement la création du lot.",
  },
  {
    valeur: "mots-de-passe",
    question: "Où sont stockés les mots de passe des tickets ?",
    reponse:
      "Dans le routeur uniquement. Ils ne sont jamais stockés en base ni journalisés par l'application. Le PDF généré est le seul endroit où ils apparaissent en clair, comme sur vos planches actuelles.",
  },
  {
    valeur: "simulation",
    question: "Que se passe-t-il avant la première génération automatique ?",
    reponse:
      "Chaque règle de réapprovisionnement passe par une simulation. Vous voyez le lot qui serait créé — profil, quantité, seuil — avant d'autoriser la génération réelle. Rien ne part sur le routeur sans cette étape.",
  },
] as const;

export function FaqAccueil() {
  return (
    <div className="flex flex-col gap-6">
      <Accordion type="single" collapsible className="w-full">
        {QUESTIONS.map((q) => (
          <AccordionItem key={q.valeur} value={q.valeur}>
            <AccordionTrigger className="text-base">{q.question}</AccordionTrigger>
            <AccordionContent className="max-w-3xl leading-relaxed text-muted-foreground">
              {q.reponse}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Alert>
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>Un objet RouterOS n&apos;est jamais supprimé</AlertTitle>
        <AlertDescription>
          Quand une correction doit retirer quelque chose, l&apos;objet est désactivé (disabled=yes), pas supprimé. Vous pouvez toujours revenir en arrière depuis WinBox ou WebFig.
        </AlertDescription>
      </Alert>
    </div>
  );
}
