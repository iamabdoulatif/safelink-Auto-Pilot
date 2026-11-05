"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

// Révélation douce au défilement : l'élément apparaît quand il entre
// dans l'écran. Si l'utilisateur préfère les mouvements réduits,
// l'élément est visible tout de suite, sans animation.
export function Revelation({
  children,
  delai = 0,
  classe,
}: {
  children: ReactNode;
  delai?: number;
  classe?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.revelation = "visible";
      return;
    }

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree?.isIntersecting) {
          element.dataset.revelation = "visible";
          observateur.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  const style = { "--delai-revelation": `${delai}ms` } as CSSProperties;

  return (
    <div ref={ref} data-revelation="cache" className={classe} style={style}>
      {children}
    </div>
  );
}
