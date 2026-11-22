"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { RouteurSafelinkhub } from "@/lib/safelinkhub-import";

// Import des routeurs déjà connectés en WireGuard dans SafeLinkHub : un
// clic remplit le formulaire de la page. Aucun second tunnel n'est créé.
type Etat = { lie: boolean; organisation?: string; routeurs?: RouteurSafelinkhub[] };

export function ImportSafelinkhub({
  libelle,
  onChoisir,
}: {
  libelle: string;
  onChoisir: (r: RouteurSafelinkhub) => void;
}) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  async function charger() {
    const r = await fetch("/api/safelinkhub", { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { data?: Etat; error?: string };
    setEtat(j.data ?? { lie: false });
    setErreur(j.error ?? null);
  }

  async function lier() {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await fetch("/api/safelinkhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setErreur(j.error ?? "Liaison impossible.");
        return;
      }
      setCode("");
      await charger();
    } finally {
      setOccupe(false);
    }
  }

  async function delier() {
    setOccupe(true);
    try {
      await fetch("/api/safelinkhub", { method: "DELETE" });
      await charger();
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer depuis SafeLinkHub</CardTitle>
        <CardDescription>
          Routeurs déjà connectés en WireGuard dans SafeLinkHub : ils sont joints par le même tunnel,
          sans nouvelle installation ni risque de coupure d&apos;accès à distance.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!ouvert ? (
          <Button type="button" variant="outline" className="w-fit" onClick={() => { setOuvert(true); void charger(); }}>
            Afficher mes routeurs SafeLinkHub
          </Button>
        ) : !etat ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            {erreur && <p className="text-sm text-destructive">{erreur}</p>}
            {!etat.lie || (erreur && !etat.routeurs) ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">
                  Dans SafeLinkHub → Réglages → Avancé, générez un code de liaison puis saisissez-le ici.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Code de liaison (8 caractères)"
                    maxLength={20}
                    className="max-w-60 font-mono uppercase"
                  />
                  <Button type="button" disabled={occupe || code.trim().length < 8} onClick={() => void lier()}>
                    Lier
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm">
                  Lié à <span className="font-medium">{etat.organisation}</span>
                  <Button type="button" variant="ghost" size="sm" disabled={occupe} onClick={() => void delier()}>
                    Délier
                  </Button>
                </p>
                {(etat.routeurs ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun routeur WireGuard dans cette organisation.</p>
                )}
                <ul className="flex flex-col divide-y rounded-lg border text-sm">
                  {(etat.routeurs ?? []).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 p-2">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant={r.online ? "secondary" : "destructive"}>{r.online ? "en ligne" : "hors ligne"}</Badge>
                      <span className="text-muted-foreground">{r.tunnelIp}</span>
                      {r.mikhmonVariant && <Badge variant="outline">{r.mikhmonVariant}</Badge>}
                      <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onChoisir(r)}>
                        {libelle}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
