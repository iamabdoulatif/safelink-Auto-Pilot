"use client";

import { useEffect, useRef, useState } from "react";
import type { ZoneCarte } from "@/lib/classification";

// Carte OpenStreetMap des zones géolocalisées (Leaflet chargé depuis
// le CDN, tuiles OSM : aucun compte ni clé). Si le CDN échoue, la
// liste des zones avec lien OSM prend le relais. Les coordonnées
// viennent des fiches zones renseignées dans le dashboard.
type LeafletMap = { remove: () => void };
type LeafletStatic = {
  map: (el: HTMLElement) => {
    setView: (c: [number, number], z: number) => unknown;
    fitBounds: (b: [number, number][]) => unknown;
  };
  tileLayer: (url: string, options: { attribution: string }) => {
    addTo: (m: unknown) => unknown;
  };
  marker: (c: [number, number]) => {
    addTo: (m: unknown) => { bindPopup: (html: string) => unknown };
  };
};

declare global {
  interface Window { L?: LeafletStatic }
}

const CDN_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const CDN_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function echapper(html: string): string {
  return html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function montant(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

export function CarteZones({ zones }: { zones: ZoneCarte[] }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [echec, setEchec] = useState(false);
  const paysDistincts = [...new Set(zones.map((z) => z.pays))].sort();
  const [paysFiltre, setPaysFiltre] = useState<string>("tous");
  const visibles = paysFiltre === "tous"
    ? zones : zones.filter((z) => z.pays === paysFiltre);

  useEffect(() => {
    if (zones.length === 0 || !conteneur.current) return;
    let annule = false;
    let carte: LeafletMap | null = null;

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = CDN_CSS;
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = CDN_JS;
    script.async = true;
    script.onerror = () => setEchec(true);
    script.onload = () => {
      if (annule || !window.L || !conteneur.current) return;
      const L = window.L;
      const instance = L.map(conteneur.current);
      carte = instance as unknown as LeafletMap;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(instance);
      const bornes: [number, number][] = [];
      for (const z of visibles) {
        const point: [number, number] = [z.latitude, z.longitude];
        bornes.push(point);
        const prix = (z.prixProfils ?? [])
          .map((x) => `${echapper(x.profil)} : ${montant(x.prix)}`).join("<br>");
        L.marker(point).addTo(instance).bindPopup(
          `📶 <strong>${echapper(z.wifiNom || z.routeurNom)}</strong>`
          + `<br>Zone : ${echapper(z.localisation || z.routeurNom)}`
          + (z.commune ? `, ${echapper(z.commune)}` : "")
          + `<br>Pays : ${echapper(z.pays)}`
          + (prix ? `<br>💰 Prix pratiqués :<br>${prix}` : "<br>Prix non renseignés")
          + `<br>Propriétaire : ${echapper(z.proprietaire)}`,
        );
      }
      if (bornes.length === 1) instance.setView(bornes[0], 13);
      else instance.fitBounds(bornes);
    };
    document.body.appendChild(script);
    return () => {
      annule = true;
      carte?.remove();
      script.remove();
      css.remove();
    };
  }, [visibles, zones]);

  if (zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune zone géolocalisée pour le moment : placez les zones
        depuis Configuration WhatsApp (recherche OpenStreetMap).
      </p>
    );
  }
  if (echec) {
    return (
      <ul className="flex flex-col gap-1 text-sm">
        {visibles.map((z) => (
          <li key={z.routeurNom + z.commune}>
            {z.routeurNom} ({z.commune || "—"}) :{" "}
            <a className="underline" target="_blank" rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${z.latitude}&mlon=${z.longitude}#map=15/${z.latitude}/${z.longitude}`}>
              voir sur OpenStreetMap
            </a>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {paysDistincts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Pays :</span>
          {["tous", ...paysDistincts].map((p) => (
            <button
              key={p} type="button"
              onClick={() => setPaysFiltre(p)}
              className={paysFiltre === p
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full border px-3 py-1 text-xs"}
            >
              {p === "tous" ? "Tous les pays" : p}
            </button>
          ))}
        </div>
      )}
      <div ref={conteneur} className="h-[420px] w-full rounded-lg border" />
      <p className="text-xs text-muted-foreground">
        {visibles.length} épingle{visibles.length > 1 ? "s" : ""} : nom du Wi-Fi,
        zone et prix pratiqués par l'opérateur. Cliquez une épingle pour le détail.
      </p>
    </div>
  );
}
