"use client";

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
    detail: "Seuil, quantité et fréquence sont propres à chaque règle.",
  },
  {
    valeur: "genere",
    icone: Sparkles,
    titre: "Génère",
    texte: "Sous le seuil, un lot est créé directement sur le routeur, au format Mikhmon : préfixe du profil, code de 8 caractères, identifiant identique au mot de passe.",
    detail: "Une simulation précède toujours la première génération réelle.",
  },
  {
    valeur: "met-en-page",
    icone: Layers,
    titre: "Met en page",
    texte: "Les tickets du lot partent dans un PDF en planche, prêt à découper pour vos revendeurs. Pas de copier-coller, pas de mise en forme à refaire.",
    detail: "Le même PDF sert à l'envoi et à l'impression.",
  },
  {
    valeur: "livre",
    icone: Send,
    titre: "Livre",
    texte: "Le PDF arrive sur le canal choisi — Telegram, WhatsApp ou impression — et chez vos autres destinataires, sans manipulation supplémentaire.",
    detail: "Chaque livraison est tracée dans l'historique.",
  },
] as const;

export function FonctionnementTabs() {
  return (
    <Tabs defaultValue="surveille" className="flex flex-col gap-6">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4" aria-label="Étapes du réapprovisionnement automatique">
        {ETAPES.map((e, i) => {
          const Icone = e.icone;
          return (
            <TabsTrigger key={e.valeur} value={e.valeur} className="gap-2">
              <Icone data-icon="inline-start" aria-hidden="true" />
              <span>
                0{i + 1} · {e.titre}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {ETAPES.map((e) => {
        const Icone = e.icone;
        return (
          <TabsContent key={e.valeur} value={e.valeur}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Icone aria-hidden="true" className="text-muted-foreground" />
                  {e.titre}
                </CardTitle>
                <CardDescription className="max-w-2xl text-base leading-relaxed">{e.texte}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">
                  <Repeat data-icon="inline-start" aria-hidden="true" />
                  {e.detail}
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
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
