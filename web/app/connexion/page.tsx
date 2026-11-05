"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wifi } from "lucide-react";
import { PAYS, PAYS_DEFAUT } from "@/lib/pays";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Connexion / inscription : le serveur pose un cookie de session signe
// (HttpOnly). Le navigateur l'envoie seul ensuite : aucun identifiant
// dans les en-tetes ni le stockage local.
export default function PageConnexion() {
  const router = useRouter();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [paysChoisi, setPaysChoisi] = useState(PAYS_DEFAUT);
  const [numeroLocal, setNumeroLocal] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mdpVisible, setMdpVisible] = useState(false);
  // Étape de validation WhatsApp, après l'inscription ou à la connexion
  // d'un compte pas encore vérifié.
  const [etape, setEtape] = useState<"formulaire" | "code">("formulaire");
  const [courrielVerif, setCourrielVerif] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [attenteRenvoi, setAttenteRenvoi] = useState(0);

  // Compte à rebours du bouton « Renvoyer le code ».
  useEffect(() => {
    if (attenteRenvoi <= 0) return;
    const minuteur = setTimeout(() => setAttenteRenvoi((s) => s - 1), 1000);
    return () => clearTimeout(minuteur);
  }, [attenteRenvoi]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Numéro complet : indicatif du pays choisi + numéro national.
  function numeroComplet(): string {
    let chiffres = numeroLocal.replace(/\D/g, "");
    const indicatif = paysChoisi.indicatif.replace("+", "");
    if (chiffres.startsWith(indicatif)) chiffres = chiffres.slice(indicatif.length);
    return `+${indicatif}${chiffres}`;
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (mode === "inscription" && motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnvoi(true);
    try {
      const reponse = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "inscription"
            ? {
                courriel,
                motDePasse,
                nom,
                prenom,
                pays: paysChoisi.nom,
                numero: numeroComplet(),
              }
            : { courriel, motDePasse },
        ),
      });
      const corps = (await reponse.json()) as {
        error?: string;
        data?: {
          verificationRequise?: boolean;
          courriel?: string;
          codeEnvoye?: boolean;
        };
      };
      // Inscription créée ou connexion d'un compte non vérifié :
      // dans les deux cas, on passe à l'écran du code WhatsApp.
      if (corps.data?.verificationRequise && corps.data.courriel) {
        setCourrielVerif(corps.data.courriel);
        setInfo(
          corps.data.codeEnvoye === false
            ? "Compte créé. L'envoi WhatsApp est indisponible pour le moment : utilisez « Renvoyer le code » dans une minute."
            : `Un code à 6 chiffres vient de partir sur votre WhatsApp (${mode === "inscription" ? numeroComplet() : "votre numéro"}). Il expire dans 10 minutes.`,
        );
        setAttenteRenvoi(60);
        setEtape("code");
        return;
      }
      if (!reponse.ok) {
        setErreur(corps.error ?? "Échec.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setEnvoi(false);
    }
  }

  async function validerCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/auth/whatsapp/verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courriel: courrielVerif, code }),
      });
      const corps = (await reponse.json()) as {
        error?: string;
        data?: { lienCommunaute?: string | null };
      };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Code refusé.");
        return;
      }
      // Compte validé et session ouverte : groupe communautaire si
      // configuré, sinon tableau de bord.
      const lien = corps.data?.lienCommunaute;
      if (lien) {
        window.location.href = lien;
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setEnvoi(false);
    }
  }

  async function renvoyerCode() {
    setErreur("");
    setInfo("");
    try {
      const reponse = await fetch("/api/auth/whatsapp/renvoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courriel: courrielVerif }),
      });
      const corps = (await reponse.json()) as { error?: string };
      if (!reponse.ok) {
        setErreur(corps.error ?? "Renvoi impossible.");
        return;
      }
      setInfo("Un nouveau code vient de partir sur votre WhatsApp.");
      setAttenteRenvoi(60);
    } catch {
      setErreur("Serveur injoignable.");
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Wifi />
          </span>
          SafeLink <span className="-ml-1 font-normal text-muted-foreground">Auto-Pilot</span>
        </span>
        <Link href="/accueil" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {etape === "code"
              ? "Validation WhatsApp"
              : mode === "connexion"
                ? "Connexion"
                : "Inscription"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etape === "code" ? (
            <form onSubmit={validerCode} className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {info || "Saisissez le code à 6 chiffres reçu sur WhatsApp."}
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="code">Code de validation</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  className="text-center font-mono text-lg tracking-[0.3em]"
                />
              </div>
              {erreur ? <p role="alert" className="text-sm text-destructive">{erreur}</p> : null}
              <Button type="submit" disabled={envoi || code.length !== 6}>
                {envoi ? "…" : "Valider et accéder à SafeLink"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={renvoyerCode}
                disabled={attenteRenvoi > 0}
              >
                {attenteRenvoi > 0
                  ? `Renvoyer le code (${attenteRenvoi} s)`
                  : "Renvoyer le code"}
              </Button>
              <button
                type="button"
                onClick={() => { setEtape("formulaire"); setErreur(""); setCode(""); }}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Revenir au formulaire
              </button>
            </form>
          ) : (
          <form onSubmit={envoyer} className="flex flex-col gap-4">
            {mode === "inscription" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="prenom">Prénom</Label>
                    <Input
                      id="prenom"
                      autoComplete="given-name"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="nom">Nom</Label>
                    <Input
                      id="nom"
                      autoComplete="family-name"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="pays">Pays</Label>
                  <select
                    id="pays"
                    autoComplete="country-name"
                    value={paysChoisi.nom}
                    onChange={(e) =>
                      setPaysChoisi(PAYS.find((p) => p.nom === e.target.value) ?? PAYS_DEFAUT)
                    }
                    required
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {PAYS.map((p) => (
                      <option key={p.nom} value={p.nom}>
                        {p.drapeau} {p.nom} ({p.indicatif})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="numero">Numéro WhatsApp</Label>
                  <div className="flex">
                    <span
                      aria-hidden="true"
                      className="flex items-center rounded-l-lg border border-r-0 border-input bg-secondary px-2.5 text-sm font-medium text-secondary-foreground"
                    >
                      {paysChoisi.indicatif}
                    </span>
                    <Input
                      id="numero"
                      type="tel"
                      autoComplete="tel-national"
                      placeholder="07 08 09 10 11"
                      value={numeroLocal}
                      onChange={(e) => setNumeroLocal(e.target.value)}
                      required
                      className="rounded-l-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le code de validation arrivera sur ce numéro WhatsApp.
                  </p>
                </div>
              </>
            ) : null}
            <div className="flex flex-col gap-1">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                type="email"
                autoComplete="email"
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mot-de-passe">Mot de passe (12 caractères minimum)</Label>
              <div className="relative">
                <Input
                  id="mot-de-passe"
                  type={mdpVisible ? "text" : "password"}
                  autoComplete={mode === "connexion" ? "current-password" : "new-password"}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                  minLength={12}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMdpVisible((v) => !v)}
                  aria-label={mdpVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {mdpVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>
            {mode === "inscription" ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="confirmation">Confirmez le mot de passe</Label>
                <Input
                  id="confirmation"
                  type={mdpVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  minLength={12}
                />
              </div>
            ) : null}
            {mode === "connexion" ? (
              <Link href="/mot-de-passe-oublie" className="text-sm underline">
                Mot de passe oublié ?
              </Link>
            ) : null}
            {erreur ? <p role="alert">{erreur}</p> : null}
            <Button type="submit" disabled={envoi}>
              {envoi ? "…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === "connexion" ? "inscription" : "connexion")}
            >
              {mode === "connexion" ? "Créer un compte" : "Déjà un compte ? Se connecter"}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
