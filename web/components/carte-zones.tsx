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

export function CarteZones({ zones }: { zones: ZoneCarte[] }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [echec, setEchec] = useState(false);

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
      for (const z of zones) {
        const point: [number, number] = [z.latitude, z.longitude];
        bornes.push(point);
        L.marker(point).addTo(instance).bindPopup(
          `<strong>${z.routeurNom}</strong><br>${z.commune || z.localisation || ""}`
          + `<br>Propriétaire : ${z.proprietaire} (${z.pays})`,
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
  }, [zones]);

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
        {zones.map((z) => (
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
  return <div ref={conteneur} className="h-[420px] w-full rounded-lg border" />;
}
