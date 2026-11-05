import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireMotDePasse } from "@/components/formulaire-mot-de-passe";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lireProfil } from "@/lib/compte";
import { sessionPage } from "@/lib/session";

// Profil du compte connecte : identite, mot de passe et deconnexion.
function formaterDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso)) + " UTC";
}

export default async function PageProfil() {
  const { utilisateurId } = await sessionPage();
  const profil = await lireProfil(utilisateurId);
  if (!profil) redirect("/connexion");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Mon profil</h1>
      <Card>
        <CardHeader>
          <CardTitle>Compte</CardTitle>
          <CardDescription>
            Le courriel identifie votre espace et ne se modifie pas ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="break-all">
            <span className="text-muted-foreground">Courriel : </span>
            {profil.courriel}
          </p>
          <p>
            <span className="text-muted-foreground">Créé le : </span>
            {formaterDate(profil.creeLe)}
          </p>
          <p>
            <span className="text-muted-foreground">Mot de passe changé le : </span>
            {profil.motDePasseChangeLe
              ? formaterDate(profil.motDePasseChangeLe)
              : "jamais"}
          </p>
          <div>
            <Button variant="outline" asChild>
              <Link href="/deconnexion">Se déconnecter</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
          <CardDescription>
            Les sessions ouvertes sur vos autres appareils seront fermées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormulaireMotDePasse />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Le lien de réinitialisation passe par votre Telegram privé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {profil.recuperationTelegram === "disponible" ? (
            <Alert>
              <AlertDescription>Récupération disponible.</AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertDescription>
                  {profil.recuperationTelegram === "groupe"
                    ? "Votre Telegram est un groupe : aucun lien ne sera envoyé, car tous ses membres pourraient l'utiliser."
                    : "Aucun Telegram configuré : aucun lien ne pourra être envoyé."}
                </AlertDescription>
              </Alert>
              <div>
                <Button variant="outline" asChild>
                  <Link href="/configuration/telegram">Configurer Telegram</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
