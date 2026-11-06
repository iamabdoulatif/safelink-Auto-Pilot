"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RolePlateforme } from "@/lib/roles-plateforme";

// Actions du superadmin sur un compte : attribution du rôle de
// plateforme et retrait définitif. Le serveur revérifie tout : ces
// contrôles ne sont qu'une commodité d'interface. Ni le superadmin
// ni un admin ne peuvent être retirés.
export function ActionsUtilisateurAdmin({
  courriel,
  role,
  superAdmin,
  moi,
}: {
  courriel: string;
  role: RolePlateforme;
  superAdmin: boolean;
  moi: string;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  if (!superAdmin) return null;

  const retirable = role === "contributeur" && courriel !== moi;

  async function envoyer(methode: string, corps?: unknown) {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await fetch(
        `/api/admin/utilisateurs/${encodeURIComponent(courriel)}`,
        {
          method: methode,
          headers: corps ? { "Content-Type": "application/json" } : undefined,
          body: corps ? JSON.stringify(corps) : undefined,
        },
      );
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setErreur(j?.error ?? "Action impossible.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErreur("Action impossible.");
      return false;
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex min-w-44 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`role-${courriel}`}>
          Rôle de {courriel}
        </label>
        <select
          id={`role-${courriel}`}
          className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs shadow-xs outline-none focus-visible:border-ring disabled:opacity-50"
          value={role === "superadmin" ? "contributeur" : role}
          disabled={occupe || role === "superadmin"}
          onChange={(e) => void envoyer("PATCH", { role: e.target.value })}
        >
          <option value="contributeur">Contributeur</option>
          <option value="admin">Admin</option>
        </select>
        {retirable && !confirmation ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            disabled={occupe}
            aria-label={`Retirer ${courriel}`}
            title="Retirer définitivement ce compte"
            onClick={() => setConfirmation(true)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>
      {role === "superadmin" ? (
        <span className="text-xs text-muted-foreground">
          Rôle défini par la configuration serveur.
        </span>
      ) : null}
      {confirmation ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-destructive">
            Supprimer définitivement {courriel} ?
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-xs"
            disabled={occupe}
            onClick={() => void envoyer("DELETE").then(() => setConfirmation(false))}
          >
            Confirmer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={occupe}
            onClick={() => setConfirmation(false)}
          >
            Annuler
          </Button>
        </div>
      ) : null}
      {erreur ? <span className="text-xs text-destructive">{erreur}</span> : null}
    </div>
  );
}
