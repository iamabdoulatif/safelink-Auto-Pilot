"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import type { Role } from "@/lib/roles";

type Espace = { tenantId: string; role: Role };

const LIBELLES: Record<Role, string> = {
  admin: "Admin",
  gerant: "Gérant",
  vendeur: "Vendeur",
};

// Sélecteur d'espace : visible seulement si la personne appartient à
// plusieurs espaces. La bascule réémet la session côté serveur puis
// recharge tout le tableau de bord sur le nouvel espace.
export function SelecteurEspace() {
  const router = useRouter();
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [actuel, setActuel] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch("/api/espaces")
      .then((r) => r.json())
      .then((j: { data?: { espaces: Espace[]; espaceActuel: string } }) => {
        if (annule || !j.data) return;
        setEspaces(j.data.espaces);
        setActuel(j.data.espaceActuel);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  if (espaces.length <= 1) return null;
  const roleActuel = espaces.find((e) => e.tenantId === actuel)?.role;

  async function basculer(cible: string) {
    setEnCours(true);
    try {
      const r = await fetch("/api/espaces/choisir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: cible }),
      });
      if (r.ok) {
        // Recharge complète : toutes les données du tableau de bord
        // dépendent de l'espace porté par la session.
        router.push("/");
        router.refresh();
      } else setEnCours(false);
    } catch {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 px-2">
      <label
        htmlFor="selecteur-espace"
        className="flex items-center gap-1.5 text-xs font-medium text-sidebar-foreground/55"
      >
        <Building2 aria-hidden="true" className="size-3.5" />
        Espace de travail
      </label>
      <select
        id="selecteur-espace"
        value={actuel}
        disabled={enCours}
        onChange={(e) => void basculer(e.target.value)}
        className="h-9 w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 text-[13px] text-sidebar-foreground shadow-xs outline-none focus-visible:border-ring"
      >
        {espaces.map((e) => (
          <option key={e.tenantId} value={e.tenantId}>
            {e.tenantId === actuel ? e.tenantId : e.tenantId} — {LIBELLES[e.role]}
          </option>
        ))}
      </select>
      {roleActuel ? (
        <p className="text-xs text-sidebar-foreground/55">
          Votre rôle ici : {LIBELLES[roleActuel]}
        </p>
      ) : null}
    </div>
  );
}
