import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireReinitialisation } from "@/components/formulaire-reinitialisation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Le jeton est dans l'URL : il ne doit pas fuiter vers un autre site.
export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — SafeLink",
  referrer: "no-referrer",
  robots: { index: false },
};

export default async function PageReinitialiser({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string | string[] }>;
}) {
  const { jeton } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {typeof jeton === "string" && jeton ? (
            <FormulaireReinitialisation jeton={jeton} />
          ) : (
            <>
              <p role="alert">Lien invalide ou expiré.</p>
              <Button asChild>
                <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
