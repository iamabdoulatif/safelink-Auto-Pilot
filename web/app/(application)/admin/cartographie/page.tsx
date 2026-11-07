import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sessionPage } from "@/lib/session";
import { estAdminPlateforme } from "@/lib/admin-utilisateurs";
import {
  classificationParCommune,
  classificationParPays,
  classificationParPersonne,
  zonesGeolocalisees,
} from "@/lib/classification";
import { CarteZones } from "@/components/carte-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// Cartographie plateforme : inscrits classés par pays, MikroTik et
// zones par personne, zones par commune, et carte OpenStreetMap des
// routeurs géolocalisés. Réservé aux admins de la plateforme.
export default async function PageCartographie() {
  await connection();
  const { utilisateurId } = await sessionPage();
  if (!(await estAdminPlateforme(utilisateurId))) redirect("/");

  const [pays, personnes, communes, zones] = await Promise.all([
    classificationParPays(),
    classificationParPersonne(),
    classificationParCommune(),
    zonesGeolocalisees(),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cartographie des inscrits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Classification par pays, MikroTik et zones par personne et par
          commune, avec la carte des zones placées précisément.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Carte des routeurs et zones</CardTitle></CardHeader>
        <CardContent>
          <CarteZones zones={zones} />
          <p className="mt-2 text-xs text-muted-foreground">
            {zones.length} zone{zones.length > 1 ? "s" : ""} géolocalisée{zones.length > 1 ? "s" : ""} sur OpenStreetMap.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Par pays</CardTitle></CardHeader>
        <CardContent className="px-0 py-2">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="pl-4">Pays</TableHead><TableHead>Inscrits</TableHead>
              <TableHead>MikroTik</TableHead><TableHead>Zones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pays.map((l) => (
                <TableRow key={l.pays}>
                  <TableCell className="pl-4 font-medium">{l.pays}</TableCell>
                  <TableCell>{l.inscrits}</TableCell>
                  <TableCell>{l.routeurs}</TableCell>
                  <TableCell>{l.zones}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Par personne</CardTitle></CardHeader>
        <CardContent className="px-0 py-2">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="pl-4">Personne</TableHead><TableHead>Pays</TableHead>
              <TableHead>MikroTik</TableHead><TableHead>Zones</TableHead><TableHead>Communes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {personnes.map((l) => (
                <TableRow key={l.courriel}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{l.nom || l.courriel}</span>
                    <span className="block text-xs text-muted-foreground">{l.courriel}</span>
                  </TableCell>
                  <TableCell>{l.pays}</TableCell>
                  <TableCell>{l.routeurs}</TableCell>
                  <TableCell>{l.zones}</TableCell>
                  <TableCell className="text-muted-foreground">{l.communes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Par commune</CardTitle></CardHeader>
        <CardContent className="px-0 py-2">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="pl-4">Commune</TableHead><TableHead>Zones</TableHead>
              <TableHead>Personnes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {communes.map((l) => (
                <TableRow key={l.commune}>
                  <TableCell className="pl-4 font-medium">{l.commune}</TableCell>
                  <TableCell>{l.zones}</TableCell>
                  <TableCell>{l.personnes}</TableCell>
                </TableRow>
              ))}
              {communes.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  Aucune zone renseignée pour le moment.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
