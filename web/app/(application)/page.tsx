import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { db } from "@/lib/db";
import { sessionPage } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AjouterParc } from "@/components/ajouter-parc";
import { CarteRouteur, Pastille } from "@/components/carte-routeur";

// Tableau de bord opérationnel (quotidien) : la question est « où
// intervenir maintenant, et le parc tient-il ? ». Niveau 1 : santé du
// parc, critiques, majeurs, tickets générés. Niveau 2 : répartition,
// nouveaux constats sur 14 jours, fraîcheur des relevés. Niveau 3 :
// les routeurs à traiter en premier, puis tout le parc en cartes.
type LigneRouteur = {
  id: number;
  nom: string;
  url_base: string;
  modele: string | null;
  dernier_releve: Date | string | null;
  critiques: string;
  majeurs: string;
};

type LigneJour = { jour: string; critiques: string; majeurs: string };

function ilYA(date: Date | string | null, maintenant: number): string {
  if (!date) return "jamais";
  const ecart = maintenant - new Date(date).getTime();
  const minutes = Math.floor(ecart / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

async function TableauBord() {
  await connection();
  const { tenantId } = await sessionPage();

  const { rows } = await db.query<LigneRouteur>(
    `SELECT r.id, r.nom, r.url_base, r.modele,
      (SELECT max(mesure_le) FROM releves
        WHERE routeur_id = r.id AND statut <> 'injoignable') AS dernier_releve,
      count(c.id) FILTER (WHERE c.gravite = 'critique') AS critiques,
      count(c.id) FILTER (WHERE c.gravite = 'majeure') AS majeurs
    FROM routeurs r
    LEFT JOIN constats c ON c.routeur_id = r.id AND c.statut = 'ouvert'
    WHERE r.actif AND r.tenant_id = $1
    GROUP BY r.id ORDER BY r.nom`,
    [tenantId],
  );

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-display text-xl">Aucun routeur enregistré</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Ajoutez votre premier routeur pour lancer la surveillance :
            diagnostic matériel, Wi-Fi et audit de configuration.
          </p>
          <AjouterParc />
        </CardContent>
      </Card>
    );
  }

  const [horloge, tendance, tickets, releves] = await Promise.all([
    db.query<{ maintenant: Date | string }>(
      `SELECT now() AS maintenant`,
    ).then((r) => r.rows[0]?.maintenant ?? new Date(0)),
    db.query<LigneJour>(
      `SELECT to_char(s.jour, 'DD/MM') AS jour,
         count(c.id) FILTER (WHERE c.gravite = 'critique') AS critiques,
         count(c.id) FILTER (WHERE c.gravite = 'majeure') AS majeurs
       FROM generate_series(
              date_trunc('day', now()) - interval '13 days',
              date_trunc('day', now()), interval '1 day') AS s(jour)
       LEFT JOIN constats c
         ON date_trunc('day', c.premier_vu_le) = s.jour
        AND c.routeur_id IN (SELECT id FROM routeurs WHERE tenant_id = $1 AND actif)
       GROUP BY s.jour ORDER BY s.jour`,
      [tenantId],
    ),
    db.query<{ t30: string; t7: string }>(
      `SELECT coalesce(sum(l.quantite_creee)
                FILTER (WHERE l.created_at > now() - interval '30 days'), 0) AS t30,
              coalesce(sum(l.quantite_creee)
                FILTER (WHERE l.created_at > now() - interval '7 days'), 0) AS t7
       FROM lots_tickets l
       JOIN routeurs r ON r.id = l.routeur_id
       WHERE r.tenant_id = $1 AND l.statut = 'genere'`,
      [tenantId],
    ),
    db.query<{ total: string; ok: string }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE rv.statut <> 'injoignable') AS ok
       FROM releves rv
       JOIN routeurs r ON r.id = rv.routeur_id
       WHERE r.tenant_id = $1 AND rv.mesure_le > now() - interval '7 days'`,
      [tenantId],
    ),
  ]);

  const maintenant = new Date(horloge).getTime();
  const totalCritiques = rows.reduce((s, r) => s + Number(r.critiques), 0);
  const totalMajeurs = rows.reduce((s, r) => s + Number(r.majeurs), 0);
  const sousControle = rows.filter(
    (r) => Number(r.critiques) === 0 && Number(r.majeurs) === 0,
  ).length;
  const avecCritiques = rows.filter((r) => Number(r.critiques) > 0).length;
  const sante = Math.round((sousControle / rows.length) * 100);
  const tickets30 = Number(tickets.rows[0]?.t30 ?? 0);
  const tickets7 = Number(tickets.rows[0]?.t7 ?? 0);
  const totalReleves = Number(releves.rows[0]?.total ?? 0);
  const relevesOk = Number(releves.rows[0]?.ok ?? 0);
  const joignabilite =
    totalReleves > 0 ? Math.round((relevesOk / totalReleves) * 100) : null;
  const dernierReleve =
    rows
      .map((r) => r.dernier_releve)
      .filter((d): d is Date | string => d !== null)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const muets = rows.filter(
    (r) =>
      !r.dernier_releve ||
      maintenant - new Date(r.dernier_releve).getTime() > 24 * 3600 * 1000,
  );
  const aTraiter = rows
    .map((r) => ({
      ...r,
      score: Number(r.critiques) * 2 + Number(r.majeurs),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const maxJour = Math.max(
    1,
    ...tendance.rows.map((j) => Number(j.critiques) + Number(j.majeurs)),
  );
  // Répartition par routeur (comme la légende) : avec critiques, avec
  // majeurs seulement, sous contrôle.
  const avecMajeursSeuls = rows.filter(
    (r) => Number(r.critiques) === 0 && Number(r.majeurs) > 0,
  ).length;
  const totalSegments = Math.max(1, rows.length);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Mis à jour à l’instant · {rows.length} routeur
        {rows.length > 1 ? "s" : ""} surveillé{rows.length > 1 ? "s" : ""} ·
        dernier relevé {ilYA(dernierReleve, maintenant)}
      </p>

      {/* Niveau 1 — les quatre indicateurs qui décident de la journée */}
      <div className="hero-entree grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-xs text-muted-foreground">Santé du parc</span>
            <span className="font-display text-4xl font-semibold tabular-nums">
              {sante}
              <span className="text-xl"> %</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {sousControle}/{rows.length} routeurs sous contrôle
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Pastille couleur="rouge" /> Critiques ouverts
            </span>
            <span className="font-display text-4xl font-semibold tabular-nums">
              {totalCritiques}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalCritiques === 0
                ? "rien d'urgent"
                : `sur ${avecCritiques} routeur${avecCritiques > 1 ? "s" : ""} — à traiter`}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Pastille couleur="ambre" /> Majeurs ouverts
            </span>
            <span className="font-display text-4xl font-semibold tabular-nums">
              {totalMajeurs}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalMajeurs === 0 ? "aucun en attente" : "à planifier cette semaine"}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-xs text-muted-foreground">
              Tickets générés (30 j)
            </span>
            <span className="font-display text-4xl font-semibold tabular-nums">
              {tickets30.toLocaleString("fr-FR")}
            </span>
            <span className="text-xs text-muted-foreground">
              dont {tickets7.toLocaleString("fr-FR")} ces 7 derniers jours
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Niveau 2 — le contexte : répartition, tendance, fraîcheur */}
      <div
        className="hero-entree grid gap-4 lg:grid-cols-3"
        style={{ animationDelay: "80ms" }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition du parc</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div
              aria-hidden="true"
              className="flex h-2.5 overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="bg-status-critique"
                style={{ width: `${(avecCritiques / totalSegments) * 100}%` }}
              />
              <div
                className="bg-status-majeur"
                style={{ width: `${(avecMajeursSeuls / totalSegments) * 100}%` }}
              />
              <div
                className="bg-status-ok"
                style={{ width: `${(sousControle / totalSegments) * 100}%` }}
              />
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Pastille couleur="vert" /> Sous contrôle
                </span>
                <span className="tabular-nums">{sousControle}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Pastille couleur="ambre" /> Avec majeurs
                </span>
                <span className="tabular-nums">{avecMajeursSeuls}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Pastille couleur="rouge" /> Avec critiques
                </span>
                <span className="tabular-nums">{avecCritiques}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nouveaux constats — 14 jours
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div
              className="flex h-24 items-end gap-1"
              role="img"
              aria-label={`Nouveaux constats par jour sur 14 jours, maximum ${maxJour} en un jour`}
            >
              {tendance.rows.map((j) => {
                const c = Number(j.critiques);
                const m = Number(j.majeurs);
                return (
                  <div
                    key={j.jour}
                    className="flex flex-1 flex-col justify-end gap-0 self-stretch"
                    title={`${j.jour} : ${c} critique${c > 1 ? "s" : ""}, ${m} majeur${m > 1 ? "s" : ""}`}
                  >
                    <div className="flex flex-col justify-end" style={{ height: "100%" }}>
                      <div
                        className="rounded-t-sm bg-status-critique"
                        style={{ height: `${(c / maxJour) * 100}%` }}
                      />
                      <div
                        className="bg-status-majeur"
                        style={{ height: `${(m / maxJour) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="flex justify-between text-xs text-muted-foreground">
              <span>{tendance.rows[0]?.jour}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Pastille couleur="rouge" /> critiques
                </span>
                <span className="flex items-center gap-1">
                  <Pastille couleur="ambre" /> majeurs
                </span>
              </span>
              <span>{tendance.rows[tendance.rows.length - 1]?.jour}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fraîcheur des relevés</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Joignables (7 j)</span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {joignabilite === null ? "—" : `${joignabilite} %`}
              </span>
            </p>
            <p className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Dernier relevé</span>
              <span className="tabular-nums">{ilYA(dernierReleve, maintenant)}</span>
            </p>
            <p className="flex items-baseline justify-between">
              <span className="text-muted-foreground">
                Sans relevé depuis 24 h
              </span>
              <span className="tabular-nums">{muets.length}</span>
            </p>
            {muets.length > 0 ? (
              <p className="text-xs text-status-majeur">
                {muets.slice(0, 3).map((r) => r.nom).join(", ")}
                {muets.length > 3 ? ` et ${muets.length - 3} autre${muets.length - 3 > 1 ? "s" : ""}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tous les routeurs répondent.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Niveau 3 — où intervenir, puis tout le parc */}
      {aTraiter.length > 0 ? (
        <Card className="hero-entree" style={{ animationDelay: "140ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Intervenir en premier</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {aTraiter.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.modele ?? r.url_base} · relevé {ilYA(r.dernier_releve, maintenant)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {Number(r.critiques) > 0 ? (
                    <Badge variant="destructive">
                      {r.critiques} critique{Number(r.critiques) > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                  {Number(r.majeurs) > 0 ? (
                    <Badge
                      variant="outline"
                      className="border-status-majeur/30 bg-status-majeur/10 text-status-majeur"
                    >
                      {r.majeurs} majeur{Number(r.majeurs) > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                  <Link
                    href="/diagnostics"
                    className="text-sm font-medium text-[var(--signal)] underline-offset-4 hover:underline"
                  >
                    Diagnostiquer
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">Tout le parc</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r, i) => (
            <CarteRouteur
              key={r.id}
              routeur={r}
              tenantId={tenantId}
              avecActions
              delai={80 + i * 70}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chargement() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}

// Coquille statique : le titre se pré-rend, les indicateurs arrivent
// en streaming.
export default function TableauDeBord() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div className="hero-entree flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tableau de bord
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Où intervenir maintenant, et si le parc tient : santé,
            constats et fraîcheur des relevés de votre espace.
          </p>
        </div>
        <AjouterParc />
      </div>
      <Suspense fallback={<Chargement />}>
        <TableauBord />
      </Suspense>
    </main>
  );
}
