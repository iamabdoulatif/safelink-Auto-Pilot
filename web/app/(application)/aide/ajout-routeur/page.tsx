import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EntetePage } from "@/components/entete-page";

// Tutoriels d'ajout d'un routeur. Un seul tunnel WireGuard par routeur,
// toujours géré par SafeLinkHub : Auto-Pilot ne colle jamais un second
// script WireGuard sur un routeur qui en a déjà un.

function Etape({ n, titre, children }: { n: number; titre: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-white">
        {n}
      </span>
      <div className="flex flex-col gap-1 pt-0.5">
        <p className="font-medium">{titre}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="block overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted p-2 font-mono text-xs text-foreground">
    {children}
  </code>
);

export default function TutorielAjoutRouteur() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <EntetePage
        titre="Ajouter un routeur"
        description="Deux cas selon que le routeur est déjà connecté à SafeLinkHub ou non. Dans les deux cas, un seul tunnel WireGuard par routeur : pas de conflit, pas de coupure d'accès à distance."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Cas 1 — Le routeur est déjà sur SafeLinkHub <Badge variant="secondary">aucun script à coller</Badge>
          </CardTitle>
          <CardDescription>
            Le routeur a déjà le tunnel WireGuard de SafeLinkHub (interface <b>safelinkhub-wg0</b>). Auto-Pilot le
            reconnaît et l&apos;ajoute tout seul.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4">
            <Etape n={1} titre="Générer un code dans SafeLinkHub">
              Sur www.safelinkhub.io : <b>Réglages → Avancé → SafeLink Auto-Pilot → « Générer un code de liaison »</b>.
              Le code (8 caractères) est valable 10 minutes et ne sert qu&apos;une fois.
            </Etape>
            <Etape n={2} titre="Lier votre espace Auto-Pilot">
              Ici : <b>Tableau de bord → Ajouter un routeur</b>, collez le code puis <b>Lier</b>. À faire une seule fois
              par espace.
            </Etape>
            <Etape n={3} titre="C'est tout : vos routeurs entrent dans le parc">
              À l&apos;ouverture du tableau de bord, chaque routeur SafeLinkHub en ligne absent du parc y est ajouté
              (bouton <b>« Déjà sur SafeLinkHub ? Synchroniser »</b> pour le faire tout de suite). SafeLinkHub pose sur le
              routeur le compte de lecture d&apos;Auto-Pilot, puis un premier relevé est fait.
            </Etape>
            <Etape n={4} titre="Garder seulement certains routeurs">
              <b>Supprimer</b> un routeur du parc l&apos;exclut de la reconnaissance automatique : il ne revient pas.
            </Etape>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Cas 2 — Nouveau routeur, sans compte SafeLinkHub <Badge variant="secondary">une ligne à coller</Badge>
          </CardTitle>
          <CardDescription>
            Vous n&apos;utilisez qu&apos;Auto-Pilot. Le tunnel WireGuard est fourni par SafeLinkHub en coulisse : aucun
            compte à créer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4">
            <Etape n={1} titre="Ouvrir l'ajout">
              <b>Tableau de bord → Ajouter un routeur → « Continuer sans compte SafeLinkHub »</b> (une seule fois par
              espace).
            </Etape>
            <Etape n={2} titre="Nommer le routeur et générer la ligne">
              Donnez un nom (ex. HSPT-QUARTIER) puis <b>« Générer la ligne à coller »</b> et <b>« Copier la ligne »</b>.
              Elle est valable 2 heures et ne sert qu&apos;une fois.
            </Etape>
            <Etape n={3} titre="La coller dans le terminal MikroTik">
              Le routeur doit avoir accès à Internet. Dans <b>WinBox → New Terminal</b>, collez la ligne puis{" "}
              <b>Entrée</b>. Le terminal affiche « SafeLinkHub : installation lancée ».
            </Etape>
            <Etape n={4} titre="Attendre l'ajout automatique">
              La fenêtre reste ouverte et vérifie toutes les 10 secondes : le routeur apparaît dans le parc en 1 à 3
              minutes, avec son premier relevé (CPU, RAM, modèle).
            </Etape>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Si le routeur portait déjà le tunnel SafeLinkHub, la même ligne ne réinstalle rien : le terminal affiche
            « SafeLinkHub déjà installé… reconnu automatiquement », et on revient au cas 1.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>En cas de problème</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-2">
            <p className="font-medium">« not enough permissions » à l&apos;ajout</p>
            <p className="text-muted-foreground">
              Le compte SafeLinkHub du routeur vient d&apos;une ancienne installation. Collez dans son terminal :
            </p>
            <Code>/user group set [find name=safelinkhub-group] policy=api,read,write,policy,test,sensitive,ssh,ftp</Code>
            <p className="text-muted-foreground">Puis « Synchroniser » dans la fenêtre d&apos;ajout.</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">Lecture REST impossible (« fetch failed »)</p>
            <p className="text-muted-foreground">
              Auto-Pilot lit le routeur par son service web (www) sur le port 85, par le tunnel. Vérifiez-le :
            </p>
            <Code>/ip service print where name=www</Code>
            <p className="text-muted-foreground">S&apos;il est sur un autre port ou désactivé :</p>
            <Code>/ip service set [find name=www] port=85 disabled=no</Code>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">« Dernier relevé : jamais » ou CPU/RAM indisponibles</p>
            <p className="text-muted-foreground">
              Les relevés passent toutes les 15 minutes. Un routeur hors ligne n&apos;est ni ajouté ni relevé : il le
              sera à son retour.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">Ne jamais coller un second script WireGuard</p>
            <p className="text-muted-foreground">
              N&apos;utilisez que la ligne générée ici (ou par SafeLinkHub) : elle détecte le tunnel existant. Un autre
              script WireGuard créerait un second tunnel et couperait l&apos;accès à distance.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Prêt ? <Link href="/" className="underline">Retour au tableau de bord</Link> puis « Ajouter un routeur ».
      </p>
    </main>
  );
}
