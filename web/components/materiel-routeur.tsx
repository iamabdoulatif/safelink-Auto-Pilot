import { lireMaterielRouteur } from "@/lib/materiel-routeur";
import { formaterMemoire } from "@/lib/extraire-materiel";

// Modele, CPU et RAM lus en direct a chaque visite du tableau de bord.
export async function MaterielRouteur({
  tenantId,
  routeurId,
  urlBase,
  modeleConnu,
}: {
  tenantId: string;
  routeurId: number;
  urlBase: string;
  modeleConnu: string | null;
}) {
  const m = await lireMaterielRouteur(tenantId, routeurId, urlBase);
  if (!m) {
    return (
      <>
        <p className="text-muted-foreground">
          Modèle : {modeleConnu ?? "inconnu"}
        </p>
        <p className="text-muted-foreground">
          CPU et RAM indisponibles : routeur injoignable ou compte de lecture
          absent.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-muted-foreground">
        Modèle : {m.modele ?? "inconnu"}
        {m.version ? ` · RouterOS ${m.version}` : ""}
      </p>
      <p className="text-muted-foreground">
        CPU : {m.cpu ?? "inconnu"}
        {m.coeurs !== null ? ` · ${m.coeurs} cœur${m.coeurs > 1 ? "s" : ""}` : ""}
        {m.chargeCpu !== null ? ` · charge ${m.chargeCpu} %` : ""}
      </p>
      <p className="text-muted-foreground">
        RAM :{" "}
        {m.ramTotale !== null && m.ramLibre !== null
          ? `${formaterMemoire(m.ramLibre)} libres sur ${formaterMemoire(m.ramTotale)}`
          : "inconnue"}
      </p>
    </>
  );
}
