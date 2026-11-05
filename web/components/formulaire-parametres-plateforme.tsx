"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// Réglages plateforme du superadmin : lien du groupe communautaire et
// webhook d'envoi du code WhatsApp. Le secret ne s'affiche jamais :
// le champ vide au moment d'enregistrer garde celui déjà stocké.
type Parametres = {
  lienCommunaute: string;
  webhookOtpUrl: string;
  secretOtpConfigure: boolean;
};

export function FormulaireParametresPlateforme() {
  const [lien, setLien] = useState("");
  const [webhook, setWebhook] = useState("");
  const [secret, setSecret] = useState("");
  const [secretConfigure, setSecretConfigure] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [charge, setCharge] = useState(true);

  useEffect(() => {
    fetch("/api/admin/parametres")
      .then((r) => r.json() as Promise<{ data?: Parametres }>)
      .then((corps) => {
        if (corps.data) {
          setLien(corps.data.lienCommunaute);
          setWebhook(corps.data.webhookOtpUrl);
          setSecretConfigure(corps.data.secretOtpConfigure);
        }
      })
      .catch(() => setErreur("Chargement impossible."))
      .finally(() => setCharge(false));
  }, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/admin/parametres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lienCommunaute: lien, webhookOtpUrl: webhook, secretOtp: secret }),
      });
      const corps = (await reponse.json()) as { error?: string; data?: Parametres };
      if (!reponse.ok || !corps.data) {
        setErreur(corps.error ?? "Enregistrement refusé.");
        return;
      }
      setSecretConfigure(corps.data.secretOtpConfigure);
      setSecret("");
      setMessage("Paramètres enregistrés. Ils s'appliquent tout de suite, sans redéploiement.");
    } catch {
      setErreur("Serveur injoignable.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Groupe communautaire et code WhatsApp</CardTitle>
        <CardDescription>
          Après la validation de son code, l&apos;utilisateur est redirigé vers le
          groupe ci-dessous. Le code part vers le webhook de votre adaptateur WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enregistrer} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lien-groupe">Lien du groupe WhatsApp ou Telegram</Label>
            <Input
              id="lien-groupe"
              type="url"
              placeholder="https://chat.whatsapp.com/… ou https://t.me/…"
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              disabled={charge}
            />
            <p className="text-xs text-muted-foreground">
              Vide : l&apos;utilisateur validé part vers son tableau de bord.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="webhook-otp">URL du webhook d&apos;envoi du code (adaptateur WhatsApp)</Label>
            <Input
              id="webhook-otp"
              type="url"
              placeholder="https://votre-adaptateur.exemple/webhook"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              disabled={charge}
            />
            <p className="text-xs text-muted-foreground">
              L&apos;application y envoie un POST signé (X-Signature) avec le numéro et le message du code.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="secret-otp">
              Secret de signature du webhook{" "}
              {secretConfigure ? <Badge variant="secondary">configuré</Badge> : <Badge variant="outline">absent</Badge>}
            </Label>
            <Input
              id="secret-otp"
              type="password"
              placeholder="Laisser vide pour garder le secret actuel"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={charge}
            />
          </div>
          {erreur ? (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="text-sm text-status-ok">
              {message}
            </p>
          ) : null}
          <Button type="submit" disabled={envoi || charge} className="w-fit">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
