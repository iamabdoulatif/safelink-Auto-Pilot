"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/lib/roles";

export type MembreAffiche = {
  courriel: string;
  role: Role;
  invitePar: string | null;
  compteExiste: boolean;
};

const LIBELLES: Record<Role, string> = {
  admin: "Admin",
  contributeur: "Contributeur",
  utilisateur: "Utilisateur",
};

const DESCRIPTIONS: Record<Role, string> = {
  admin: "Gère tout : routeurs, canaux, membres et validations.",
  contributeur: "Génère, envoie et corrige les tickets au quotidien.",
  utilisateur: "Consulte le parc, les diagnostics et l'historique.",
};

const CLASSE_SELECT =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring";

// Gestion des membres d'un espace. Les contrôles d'écriture ne sont
// affichés qu'aux admins, mais le serveur revérifie toujours le rôle.
export function GestionMembres({
  membres,
  monRole,
  proprietaire,
  moi,
}: {
  membres: MembreAffiche[];
  monRole: Role | null;
  proprietaire: string;
  moi: string;
}) {
  const router = useRouter();
  const [courriel, setCourriel] = useState("");
  const [role, setRole] = useState<Role>("utilisateur");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const admin = monRole === "admin";

  async function agir(action: () => Promise<Response>, succes: string) {
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await action();
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setErreur(j?.error ?? "Action impossible.");
        return;
      }
      setMessage(succes);
      router.refresh();
    } catch {
      setErreur("Action impossible.");
    } finally {
      setOccupe(false);
    }
  }

  function inviter(e: React.FormEvent) {
    e.preventDefault();
    void agir(
      () =>
        fetch("/api/membres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courriel, role }),
        }),
      "Invitation enregistrée. La personne rejoindra l'espace avec ce courriel.",
    ).then(() => setCourriel(""));
  }

  function changerRole(cible: string, nouveau: Role) {
    void agir(
      () =>
        fetch(`/api/membres/${encodeURIComponent(cible)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nouveau }),
        }),
      "Rôle mis à jour.",
    );
  }

  function retirer(cible: string) {
    void agir(
      () =>
        fetch(`/api/membres/${encodeURIComponent(cible)}`, { method: "DELETE" }),
      "Membre retiré de l'espace.",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur ? (
        <Alert variant="destructive">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium">Membre</th>
              <th className="px-3 py-2 font-medium">Rôle</th>
              <th className="px-3 py-2 font-medium">Compte</th>
              {admin ? <th className="px-3 py-2 font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => (
              <tr key={m.courriel} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="break-all">{m.courriel}</span>
                  {m.courriel === proprietaire ? (
                    <Badge variant="outline" className="ml-2">Propriétaire</Badge>
                  ) : null}
                  {m.courriel === moi ? (
                    <Badge variant="outline" className="ml-2">Vous</Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {admin && m.courriel !== proprietaire ? (
                    <select
                      aria-label={`Rôle de ${m.courriel}`}
                      className={CLASSE_SELECT}
                      value={m.role}
                      disabled={occupe}
                      onChange={(e) => changerRole(m.courriel, e.target.value as Role)}
                    >
                      {(Object.keys(LIBELLES) as Role[]).map((r) => (
                        <option key={r} value={r}>{LIBELLES[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge>{LIBELLES[m.role]}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {m.compteExiste ? "Inscrit" : "Invitation en attente"}
                </td>
                {admin ? (
                  <td className="px-3 py-2">
                    {m.courriel !== proprietaire ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={occupe}
                        aria-label={`Retirer ${m.courriel}`}
                        onClick={() => retirer(m.courriel)}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
        {(Object.keys(LIBELLES) as Role[]).map((r) => (
          <p key={r} className="rounded-lg border p-3">
            <span className="font-medium text-foreground">{LIBELLES[r]} — </span>
            {DESCRIPTIONS[r]}
          </p>
        ))}
      </div>

      {admin ? (
        <form onSubmit={inviter} className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserPlus aria-hidden="true" className="size-4" />
            Inviter un membre
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="courriel-membre">Courriel</Label>
              <Input
                id="courriel-membre"
                type="email"
                required
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
                placeholder="collegue@exemple.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-membre">Rôle</Label>
              <select
                id="role-membre"
                className={CLASSE_SELECT}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {(Object.keys(LIBELLES) as Role[]).map((r) => (
                  <option key={r} value={r}>{LIBELLES[r]}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={occupe}>
              Inviter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Si la personne n’a pas encore de compte, elle rejoindra
            automatiquement cet espace à son inscription avec ce courriel.
          </p>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Seul un admin de l’espace peut inviter des membres ou changer les rôles.
        </p>
      )}
    </div>
  );
}
