"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

// Petites illustrations Three.js des sections de la page publique.
// Chaque visuel est construit en code et ne démarre que lorsqu'il
// approche de l'écran, pour garder la page fluide.
type ModuleThree = typeof import("three");

export type VarianteIllustration =
  | "stock"
  | "diagnostic"
  | "canaux"
  | "securite"
  | "publics";

type Illustration = {
  groupe: InstanceType<ModuleThree["Group"]>;
  maj: (temps: number, vitesse: number) => void;
};

export function Illustration3D({
  variante,
  titre,
  legende,
}: {
  variante: VarianteIllustration;
  titre: string;
  legende: string;
}) {
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur) return;

    let annule = false;
    let demarre = false;
    let nettoyer: () => void = () => undefined;

    const demarrer = () => {
      if (demarre) return;
      demarre = true;
      import("three")
        .then((THREE) => {
          if (annule) return;
          nettoyer = initialiserIllustration(THREE, conteneur, variante, () =>
            setErreur(true),
          );
        })
        .catch(() => setErreur(true));
    };

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree?.isIntersecting) demarrer();
      },
      { rootMargin: "320px" },
    );
    observateur.observe(conteneur);

    return () => {
      annule = true;
      observateur.disconnect();
      nettoyer();
    };
  }, [variante]);

  return (
    <figure className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div
        ref={conteneurRef}
        role="img"
        aria-label={titre}
        className="h-52 w-full sm:h-60"
      />
      <figcaption className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <span className="text-sm font-medium">{legende}</span>
        <Badge variant="secondary">3D</Badge>
      </figcaption>
      {erreur ? (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Illustration 3D indisponible sur ce navigateur.
        </p>
      ) : null}
    </figure>
  );
}

function initialiserIllustration(
  THREE: ModuleThree,
  conteneur: HTMLDivElement,
  variante: VarianteIllustration,
  onErreur: () => void,
) {
  let renderer: InstanceType<ModuleThree["WebGLRenderer"]> | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    onErreur();
    return () => undefined;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.9, 6.4);
  camera.lookAt(0, 0.25, 0);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  conteneur.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xf3f3f3, 0x191a23, 1.9));
  const lumiere = new THREE.DirectionalLight(0xf3f3f3, 2.4);
  lumiere.position.set(3.5, 5, 4.5);
  lumiere.castShadow = true;
  lumiere.shadow.mapSize.set(1024, 1024);
  scene.add(lumiere);
  const accent = new THREE.DirectionalLight(0xb9ff66, 1.0);
  accent.position.set(-4, 2.5, -3);
  scene.add(accent);

  const illustration = creerIllustration(THREE, variante);
  scene.add(illustration.groupe);
  scene.add(creerSol(THREE));

  const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const souris = { x: 0, y: 0, cibleX: 0, cibleY: 0 };
  const onPointerMove = (event: PointerEvent) => {
    const rect = conteneur.getBoundingClientRect();
    souris.cibleX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    souris.cibleY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  const onPointerLeave = () => {
    souris.cibleX = 0;
    souris.cibleY = 0;
  };
  conteneur.addEventListener("pointermove", onPointerMove);
  conteneur.addEventListener("pointerleave", onPointerLeave);

  const redimensionner = () => {
    const largeur = Math.max(conteneur.clientWidth, 1);
    const hauteur = Math.max(conteneur.clientHeight, 1);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    renderer?.setSize(largeur, hauteur, false);
  };
  const observateurTaille = new ResizeObserver(redimensionner);
  observateurTaille.observe(conteneur);
  redimensionner();

  let visible = true;
  const observateurVisibilite = new IntersectionObserver(
    ([entree]) => {
      visible = entree?.isIntersecting ?? true;
    },
    { threshold: 0.05 },
  );
  observateurVisibilite.observe(conteneur);

  const horloge = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const temps = horloge.getElapsedTime();
    const vitesse = mouvementReduit ? 0 : 1;
    souris.x += (souris.cibleX - souris.x) * 0.04;
    souris.y += (souris.cibleY - souris.y) * 0.04;
    illustration.groupe.rotation.y = souris.x * 0.22;
    illustration.groupe.rotation.x = -souris.y * 0.07;
    illustration.maj(temps, vitesse);
    renderer?.render(scene, camera);
  });

  return () => {
    observateurTaille.disconnect();
    observateurVisibilite.disconnect();
    conteneur.removeEventListener("pointermove", onPointerMove);
    conteneur.removeEventListener("pointerleave", onPointerLeave);
    renderer?.setAnimationLoop(null);
    scene.traverse((objet) => {
      const mesh = objet as Partial<InstanceType<ModuleThree["Mesh"]>>;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const material of materials) {
        const avecTexture = material as InstanceType<ModuleThree["MeshStandardMaterial"]>;
        avecTexture.map?.dispose();
        material.dispose();
      }
    });
    renderer?.dispose();
    renderer?.domElement.remove();
  };
}

function creerIllustration(THREE: ModuleThree, variante: VarianteIllustration): Illustration {
  switch (variante) {
    case "stock":
      return creerStock(THREE);
    case "diagnostic":
      return creerDiagnostic(THREE);
    case "canaux":
      return creerCanaux(THREE);
    case "securite":
      return creerSecurite(THREE);
    case "publics":
      return creerPublics(THREE);
  }
}

function creerSol(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const disque = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 64),
    new THREE.MeshBasicMaterial({
      color: 0xb9ff66,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    }),
  );
  disque.rotation.x = -Math.PI / 2;
  disque.position.y = -1.28;
  groupe.add(disque);

  const ombre = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  ombre.rotation.x = -Math.PI / 2;
  ombre.position.y = -1.27;
  ombre.receiveShadow = true;
  groupe.add(ombre);
  return groupe;
}

function creerStock(THREE: ModuleThree): Illustration {
  const groupe = new THREE.Group();
  const tickets: Array<{
    groupe: InstanceType<ModuleThree["Group"]>;
    baseY: number;
    phase: number;
  }> = [];

  [
    { code: "10j48372", x: -0.95, y: -0.15, z: 0.25, rot: -0.16, phase: 0.2 },
    { code: "1j638291", x: 0.15, y: 0.28, z: 0.55, rot: 0.08, phase: 1.4 },
    { code: "7j205914", x: 1.05, y: 0.72, z: 0.15, rot: 0.2, phase: 2.5 },
  ].forEach((definition) => {
    const ticket = creerCarteTicket(THREE, definition.code);
    ticket.position.set(definition.x, definition.y, definition.z);
    ticket.rotation.set(-0.12, -0.18, definition.rot);
    groupe.add(ticket);
    tickets.push({ groupe: ticket, baseY: definition.y, phase: definition.phase });
  });

  const anneau = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.035, 12, 96, Math.PI * 1.45),
    new THREE.MeshBasicMaterial({ color: 0xb9ff66, transparent: true, opacity: 0.8 }),
  );
  anneau.rotation.set(Math.PI / 2.25, 0, Math.PI * 0.78);
  anneau.position.y = -0.72;
  groupe.add(anneau);

  const seuil = creerEtiquette(THREE, "Seuil atteint → nouveau lot", "#191a23", "#f3f3f3");
  seuil.position.set(0, -1.02, 0.95);
  seuil.scale.setScalar(0.82);
  groupe.add(seuil);

  return {
    groupe,
    maj: (temps, vitesse) => {
      tickets.forEach((ticket) => {
        ticket.groupe.position.y =
          ticket.baseY + Math.sin(temps * 1.25 + ticket.phase) * 0.07 * vitesse;
        ticket.groupe.rotation.z += 0.0006 * vitesse;
      });
      anneau.rotation.z = Math.PI * 0.78 + temps * 0.35 * vitesse;
    },
  };
}

function creerDiagnostic(THREE: ModuleThree): Illustration {
  const groupe = new THREE.Group();
  const points: Array<InstanceType<ModuleThree["Vector3"]>> = [];
  const signal = [-0.55, -0.52, -0.2, 0.48, 0.78, -0.28, -0.5, -0.46, 0.1, 0.62, 0.35, -0.45];
  signal.forEach((y, index) => {
    points.push(new THREE.Vector3(-2.15 + index * 0.39, y, 0.55));
  });
  const courbe = new THREE.CatmullRomCurve3(points);
  const ligne = new THREE.Mesh(
    new THREE.TubeGeometry(courbe, 72, 0.028, 8),
    new THREE.MeshBasicMaterial({ color: 0xb9ff66 }),
  );
  groupe.add(ligne);

  const impulsion = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 18, 18),
    new THREE.MeshStandardMaterial({
      color: 0xb9ff66,
      emissive: 0xb9ff66,
      emissiveIntensity: 1.7,
    }),
  );
  groupe.add(impulsion);

  const routeurs: Array<InstanceType<ModuleThree["Group"]>> = [];
  [-1.45, 0, 1.45].forEach((x, index) => {
    const routeur = creerMiniRouteur(THREE, index === 1 ? 0xc24e2d : 0xb9ff66);
    routeur.position.set(x, -0.92, -0.55);
    groupe.add(routeur);
    routeurs.push(routeur);
  });

  const etiquette = creerEtiquette(THREE, "CPU • RAM • Wi-Fi • Ports", "#f3f3f3", "#191a23");
  etiquette.position.set(0, 1.08, 0.2);
  groupe.add(etiquette);

  return {
    groupe,
    maj: (temps, vitesse) => {
      const progression = (temps * 0.18 * Math.max(vitesse, 0.001)) % 1;
      impulsion.position.copy(courbe.getPointAt(vitesse === 0 ? 0.45 : progression));
      routeurs.forEach((routeur, index) => {
        routeur.position.y = -0.92 + Math.sin(temps * 1.1 + index) * 0.035 * vitesse;
      });
    },
  };
}

function creerCanaux(THREE: ModuleThree): Illustration {
  // Schéma de livraison : le PDF à gauche, trois destinations à droite —
  // avion Telegram, bulle WhatsApp et vraie imprimante, reliés par des
  // trajets où circulent des impulsions vertes.
  const groupe = new THREE.Group();
  const document = creerDocumentPDF(THREE);
  document.position.set(-1.55, 0.05, 0.35);
  document.rotation.y = 0.22;
  groupe.add(document);

  const telegram = creerTelegram(THREE);
  telegram.position.set(1.32, 0.85, 0.25);
  groupe.add(telegram);

  const whatsapp = creerWhatsApp(THREE);
  whatsapp.position.set(1.98, -0.05, 0.65);
  groupe.add(whatsapp);

  const mac = creerMac(THREE);
  mac.position.set(-0.62, -1.0, -0.1);
  mac.scale.setScalar(0.8);
  groupe.add(mac);

  const imprimante = creerImprimante(THREE);
  imprimante.groupe.position.set(0.68, -1.02, 0.35);
  imprimante.groupe.scale.setScalar(0.88);
  groupe.add(imprimante.groupe);

  // Câble qui raccorde le Mac à l'imprimante (canal PrintNode).
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.12, -1.08, -0.02),
        new THREE.Vector3(0.16, -1.32, 0.12),
        new THREE.Vector3(0.36, -1.14, 0.28),
        new THREE.Vector3(0.46, -0.86, 0.35),
      ]),
      32,
      0.02,
      8,
    ),
    new THREE.MeshStandardMaterial({ color: 0x191a23, roughness: 0.55 }),
  );
  groupe.add(cable);

  const destinations = [
    { groupe: telegram, baseY: 0.85, phase: 0 },
    { groupe: whatsapp, baseY: -0.05, phase: 1.3 },
    { groupe: imprimante.groupe, baseY: -1.02, phase: 2.4 },
  ];

  const cibles = [
    new THREE.Vector3(1.32, 0.85, 0.25),
    new THREE.Vector3(1.98, -0.05, 0.65),
    new THREE.Vector3(0.05, -0.8, 0.2),
  ];
  const trajets: Array<{
    courbe: InstanceType<ModuleThree["QuadraticBezierCurve3"]>;
    impulsion: InstanceType<ModuleThree["Mesh"]>;
    phase: number;
  }> = [];

  cibles.forEach((cible, index) => {
    const milieu = new THREE.Vector3(0.05, cible.y + 0.42, 0.72);
    const courbe = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.78, 0.18, 0.55),
      milieu,
      cible.clone(),
    );
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(courbe, 36, 0.018, 8),
      new THREE.MeshBasicMaterial({ color: 0x191a23, transparent: true, opacity: 0.38 }),
    );
    groupe.add(tube);

    const impulsion = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xb9ff66,
        emissive: 0xb9ff66,
        emissiveIntensity: 1.6,
      }),
    );
    groupe.add(impulsion);
    trajets.push({ courbe, impulsion, phase: index * 0.27 });
  });

  return {
    groupe,
    maj: (temps, vitesse) => {
      document.rotation.y = 0.22 + Math.sin(temps * 0.8) * 0.07 * vitesse;
      document.position.y = 0.05 + Math.sin(temps * 1.15) * 0.05 * vitesse;
      destinations.forEach((destination) => {
        destination.groupe.position.y =
          destination.baseY + Math.sin(temps * 1.1 + destination.phase) * 0.045 * vitesse;
      });
      mac.position.y = -1.0 + Math.sin(temps * 1.1 + 2.4) * 0.045 * vitesse;
      mac.rotation.y = -0.06 + Math.sin(temps * 0.6 + 0.5) * 0.05 * vitesse;
      telegram.rotation.y = Math.sin(temps * 0.7) * 0.1 * vitesse;
      whatsapp.rotation.y = -0.08 + Math.sin(temps * 0.7 + 1) * 0.09 * vitesse;
      // La feuille imprimée sort en boucle, puis recommence.
      const cycle = vitesse === 0 ? 0.55 : (temps * 0.28) % 1;
      imprimante.papier.position.y = -0.18 - cycle * 0.22;
      imprimante.papier.position.z = 0.4 + cycle * 0.08;
      imprimante.papierMateriau.opacity = cycle > 0.88 ? 1 - (cycle - 0.88) / 0.12 : 1;
      trajets.forEach((trajet) => {
        const progression = vitesse === 0 ? 0.5 : (temps * 0.24 + trajet.phase) % 1;
        trajet.impulsion.position.copy(trajet.courbe.getPoint(progression));
      });
    },
  };
}

function creerTelegram(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  // Disque bleu nuit bordé d'un fin anneau crème, façon pastille d'app.
  const disque = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.37, 0.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x191a23, roughness: 0.32, metalness: 0.08 }),
  );
  disque.rotation.x = Math.PI / 2;
  disque.castShadow = true;
  groupe.add(disque);

  const anneau = new THREE.Mesh(
    new THREE.TorusGeometry(0.37, 0.018, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.4 }),
  );
  anneau.position.z = 0.05;
  groupe.add(anneau);

  // Avion en papier en relief : aile claire, aile grisée pour le pli,
  // et fine arête centrale pour lire le pliage.
  const aileClaire = creerFaceAvion(THREE, [0.32, 0.06, -0.26, 0.24, -0.03, 0.0], 0xfbf8f0);
  const aileGrise = creerFaceAvion(THREE, [0.32, 0.06, -0.03, 0.0, -0.22, -0.2], 0xd8d2c0);
  aileClaire.position.z = 0.075;
  aileGrise.position.z = 0.07;
  groupe.add(aileClaire);
  groupe.add(aileGrise);

  const arete = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.32, 0.06, 0.085),
        new THREE.Vector3(0.12, 0.02, 0.1),
        new THREE.Vector3(-0.03, 0.0, 0.09),
      ]),
      12,
      0.012,
      8,
    ),
    new THREE.MeshStandardMaterial({ color: 0x191a23, roughness: 0.5 }),
  );
  groupe.add(arete);

  const etiquette = creerEtiquette(THREE, "Telegram", "#191a23", "#f3f3f3");
  etiquette.position.set(0, -0.52, 0.12);
  etiquette.scale.setScalar(0.52);
  groupe.add(etiquette);
  return groupe;
}

function creerFaceAvion(
  THREE: ModuleThree,
  sommets: [number, number, number, number, number, number],
  couleur: number,
) {
  const [x1, y1, x2, y2, x3, y3] = sommets;
  const forme = new THREE.Shape();
  forme.moveTo(x1, y1);
  forme.lineTo(x2, y2);
  forme.lineTo(x3, y3);
  forme.closePath();
  const geometrie = new THREE.ExtrudeGeometry(forme, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  const face = new THREE.Mesh(
    geometrie,
    new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.45, side: THREE.DoubleSide }),
  );
  face.rotation.z = -0.12;
  return face;
}

function creerWhatsApp(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  // Bulle de discussion verte, queue comprise dans la silhouette.
  const forme = new THREE.Shape();
  const l = 0.37;
  const h = 0.31;
  const r = 0.17;
  forme.moveTo(-l + r, -h);
  forme.lineTo(-0.12, -h);
  forme.lineTo(-0.22, -h - 0.16);
  forme.lineTo(0.02, -h);
  forme.lineTo(l - r, -h);
  forme.quadraticCurveTo(l, -h, l, -h + r);
  forme.lineTo(l, h - r);
  forme.quadraticCurveTo(l, h, l - r, h);
  forme.lineTo(-l + r, h);
  forme.quadraticCurveTo(-l, h, -l, h - r);
  forme.lineTo(-l, -h + r);
  forme.quadraticCurveTo(-l, -h, -l + r, -h);

  const bulle = new THREE.Mesh(
    new THREE.ExtrudeGeometry(forme, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    }),
    new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.35, metalness: 0.05 }),
  );
  bulle.castShadow = true;
  groupe.add(bulle);

  // Combiné téléphonique blanc au centre de la bulle.
  const combine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.48),
    new THREE.MeshBasicMaterial({ map: creerTextureCombine(THREE), transparent: true }),
  );
  combine.position.z = 0.16;
  groupe.add(combine);

  const etiquette = creerEtiquette(THREE, "WhatsApp", "#b9ff66", "#191a23");
  etiquette.position.set(0, -0.58, 0.12);
  etiquette.scale.setScalar(0.52);
  groupe.add(etiquette);
  groupe.rotation.y = -0.08;
  return groupe;
}

function creerTextureCombine(THREE: ModuleThree) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const contexte = canvas.getContext("2d");
  if (contexte) {
    contexte.clearRect(0, 0, canvas.width, canvas.height);
    contexte.fillStyle = "#fbf8f0";
    contexte.font = "700 165px Arial, sans-serif";
    contexte.textAlign = "center";
    contexte.textBaseline = "middle";
    contexte.fillText("☎", canvas.width / 2, canvas.height / 2 + 10);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function creerMac(THREE: ModuleThree) {
  // iMac vu de face : écran avec fenêtre d'impression macOS, pied alu.
  const groupe = new THREE.Group();
  const cadre = new THREE.Mesh(
    geometrieCarte(THREE, 1.18, 0.8, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd9d5c9, roughness: 0.35, metalness: 0.45 }),
  );
  cadre.castShadow = true;
  groupe.add(cadre);

  const ecran = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 0.66),
    new THREE.MeshStandardMaterial({ map: creerTextureEcranMac(THREE), roughness: 0.35 }),
  );
  ecran.position.set(0, 0.04, 0.04);
  groupe.add(ecran);

  const menton = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.09, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xcac5b6, roughness: 0.35, metalness: 0.45 }),
  );
  menton.position.set(0, -0.4, 0);
  groupe.add(menton);

  const cou = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.28, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xcac5b6, roughness: 0.35, metalness: 0.45 }),
  );
  cou.position.set(0, -0.58, -0.06);
  cou.rotation.x = 0.18;
  groupe.add(cou);

  const pied = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 0.045, 32),
    new THREE.MeshStandardMaterial({ color: 0xcac5b6, roughness: 0.35, metalness: 0.45 }),
  );
  pied.scale.z = 0.55;
  pied.position.set(0, -0.74, -0.02);
  groupe.add(pied);
  groupe.rotation.y = -0.06;
  return groupe;
}

function creerTextureEcranMac(THREE: ModuleThree) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const contexte = canvas.getContext("2d");
  if (contexte) {
    // Fond d'écran : nuit vers vert, dans la charte du site.
    const degrade = contexte.createLinearGradient(0, 0, 640, 400);
    degrade.addColorStop(0, "#191a23");
    degrade.addColorStop(1, "#2e4a1f");
    contexte.fillStyle = degrade;
    contexte.fillRect(0, 0, 640, 400);
    // Barre de menu macOS.
    contexte.fillStyle = "rgba(244, 239, 227, 0.92)";
    contexte.fillRect(0, 0, 640, 34);
    contexte.fillStyle = "#191a23";
    contexte.font = "700 19px Arial, sans-serif";
    contexte.fillText(" SafeLink — Impression", 14, 24);
    contexte.font = "500 17px Arial, sans-serif";
    contexte.fillText("PrintNode", 520, 24);
    // Fenêtre d'impression.
    contexte.fillStyle = "#fbf8f0";
    contexte.fillRect(110, 78, 420, 250);
    contexte.fillStyle = "#e7dfca";
    contexte.fillRect(110, 78, 420, 44);
    contexte.fillStyle = "#191a23";
    contexte.font = "700 21px Arial, sans-serif";
    contexte.fillText("Tickets Hotspot — PDF", 132, 108);
    contexte.font = "500 18px Arial, sans-serif";
    contexte.fillStyle = "#5a657d";
    contexte.fillText("Lot prêt · planche à découper", 132, 152);
    contexte.fillText("Imprimante : bureau", 132, 184);
    for (let i = 0; i < 3; i++) {
      const y = 206 + i * 30;
      contexte.strokeStyle = "#ddd4bc";
      contexte.strokeRect(132, y, 300, 22);
      contexte.fillStyle = i === 0 ? "#4d7c0f" : "#191a23";
      contexte.beginPath();
      contexte.arc(146, y + 11, 5, 0, Math.PI * 2);
      contexte.fill();
    }
    // Bouton Imprimer vert.
    contexte.fillStyle = "#b9ff66";
    contexte.fillRect(356, 272, 140, 36);
    contexte.fillStyle = "#191a23";
    contexte.font = "700 19px Arial, sans-serif";
    contexte.textAlign = "center";
    contexte.fillText("Imprimer", 426, 297);
    contexte.textAlign = "left";
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function creerImprimante(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const corps = new THREE.Mesh(
    geometrieCarte(THREE, 1.0, 0.56, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x191a23, roughness: 0.42 }),
  );
  corps.castShadow = true;
  groupe.add(corps);

  const couvercle = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.07, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }),
  );
  couvercle.position.set(0, 0.31, -0.04);
  groupe.add(couvercle);

  // Feuille vierge qui entre par le haut, légèrement penchée en arrière.
  const papierEntree = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.55, side: THREE.DoubleSide }),
  );
  papierEntree.position.set(0, 0.56, -0.14);
  papierEntree.rotation.x = -0.32;
  groupe.add(papierEntree);

  const bandeAvant = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.15, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.5 }),
  );
  bandeAvant.position.set(0, 0.04, 0.32);
  groupe.add(bandeAvant);

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 14),
    new THREE.MeshStandardMaterial({
      color: 0xb9ff66,
      emissive: 0xb9ff66,
      emissiveIntensity: 1.6,
    }),
  );
  led.position.set(0.33, 0.04, 0.35);
  groupe.add(led);

  // Feuille imprimée qui sort par l'avant (animée dans maj).
  const papierMateriau = new THREE.MeshStandardMaterial({
    map: creerTexturePDF(THREE),
    roughness: 0.55,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const papier = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), papierMateriau);
  papier.position.set(0, -0.18, 0.4);
  papier.rotation.x = 0.38;
  groupe.add(papier);

  const etiquette = creerEtiquette(THREE, "Impression", "#191a23", "#f3f3f3");
  etiquette.position.set(0, -0.6, 0.12);
  etiquette.scale.setScalar(0.52);
  groupe.add(etiquette);
  return { groupe, papier, papierMateriau };
}

function creerSecurite(THREE: ModuleThree): Illustration {
  const groupe = new THREE.Group();
  const bouclier = creerBouclier(THREE);
  bouclier.position.set(-0.75, 0.05, 0.25);
  groupe.add(bouclier);

  const cadenas = creerCadenas(THREE);
  cadenas.position.set(1.05, -0.12, 0.45);
  groupe.add(cadenas);

  const anneau = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.025, 10, 96),
    new THREE.MeshBasicMaterial({ color: 0xb9ff66, transparent: true, opacity: 0.55 }),
  );
  anneau.rotation.x = Math.PI / 2.35;
  anneau.position.y = -0.78;
  groupe.add(anneau);

  const lecture = creerEtiquette(THREE, "Lecture seule", "#b9ff66", "#191a23");
  lecture.position.set(-0.78, -1.0, 0.8);
  lecture.scale.setScalar(0.72);
  groupe.add(lecture);
  const ecriture = creerEtiquette(THREE, "Écriture validée", "#c24e2d", "#f3f3f3");
  ecriture.position.set(1.02, -1.0, 0.8);
  ecriture.scale.setScalar(0.72);
  groupe.add(ecriture);

  return {
    groupe,
    maj: (temps, vitesse) => {
      bouclier.position.y = 0.05 + Math.sin(temps * 1.05) * 0.055 * vitesse;
      bouclier.rotation.y = Math.sin(temps * 0.65) * 0.1 * vitesse;
      cadenas.rotation.y = -0.12 + Math.sin(temps * 0.8 + 1) * 0.08 * vitesse;
      anneau.rotation.z = temps * 0.28 * vitesse;
    },
  };
}

function creerPublics(THREE: ModuleThree): Illustration {
  const groupe = new THREE.Group();
  const personnes: Array<InstanceType<ModuleThree["Group"]>> = [];
  const definitions = [
    { nom: "Gérant", x: -1.55, couleur: 0x191a23 },
    { nom: "Revendeur", x: 0, couleur: 0xb9ff66 },
    { nom: "Technicien", x: 1.55, couleur: 0xc24e2d },
  ];

  definitions.forEach((definition, index) => {
    const personne = creerPersonne(THREE, definition.couleur, definition.nom);
    personne.position.set(definition.x, -0.18, index === 1 ? 0.45 : 0);
    groupe.add(personne);
    personnes.push(personne);
  });

  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.022, 10, 80, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x191a23, transparent: true, opacity: 0.42 }),
  );
  arc.position.y = 0.52;
  arc.rotation.z = 0;
  groupe.add(arc);

  return {
    groupe,
    maj: (temps, vitesse) => {
      personnes.forEach((personne, index) => {
        personne.position.y = -0.18 + Math.sin(temps * 1.2 + index * 0.9) * 0.055 * vitesse;
        personne.rotation.y = Math.sin(temps * 0.65 + index) * 0.08 * vitesse;
      });
      arc.rotation.y = Math.sin(temps * 0.5) * 0.08 * vitesse;
    },
  };
}

function creerCarteTicket(THREE: ModuleThree, code: string) {
  const groupe = new THREE.Group();
  const corps = new THREE.Mesh(
    geometrieCarte(THREE, 1.42, 0.88, 0.045),
    new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.48 }),
  );
  corps.castShadow = true;
  groupe.add(corps);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, 0.8),
    new THREE.MeshStandardMaterial({
      map: creerTextureMiniTicket(THREE, code),
      roughness: 0.5,
      transparent: true,
    }),
  );
  face.position.z = 0.036;
  groupe.add(face);
  return groupe;
}

function creerMiniRouteur(THREE: ModuleThree, couleurLed: number) {
  const groupe = new THREE.Group();
  const corps = new THREE.Mesh(
    geometrieCarte(THREE, 1.05, 0.34, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.45 }),
  );
  corps.castShadow = true;
  groupe.add(corps);

  for (let i = 0; i < 3; i++) {
    const port = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.13, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 }),
    );
    port.position.set(-0.28 + i * 0.28, -0.03, 0.27);
    groupe.add(port);
  }
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 14),
    new THREE.MeshStandardMaterial({
      color: couleurLed,
      emissive: couleurLed,
      emissiveIntensity: 1.5,
    }),
  );
  led.position.set(0.38, 0.09, 0.27);
  groupe.add(led);

  [-0.34, 0.34].forEach((x) => {
    const antenne = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.025, 0.42, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0x191a23, roughness: 0.45 }),
    );
    antenne.position.set(x, 0.38, -0.12);
    antenne.rotation.z = x < 0 ? 0.1 : -0.1;
    groupe.add(antenne);
  });
  return groupe;
}

function creerDocumentPDF(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const page = new THREE.Mesh(
    geometrieCarte(THREE, 1.25, 1.62, 0.045),
    new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.5 }),
  );
  page.castShadow = true;
  groupe.add(page);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 1.52),
    new THREE.MeshStandardMaterial({
      map: creerTexturePDF(THREE),
      roughness: 0.5,
      transparent: true,
    }),
  );
  face.position.z = 0.036;
  groupe.add(face);
  return groupe;
}

function creerBouclier(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const forme = new THREE.Shape();
  forme.moveTo(0, 0.92);
  forme.quadraticCurveTo(0.72, 0.72, 0.78, 0.62);
  forme.quadraticCurveTo(0.72, -0.38, 0, -0.92);
  forme.quadraticCurveTo(-0.72, -0.38, -0.78, 0.62);
  forme.quadraticCurveTo(-0.72, 0.72, 0, 0.92);

  const bouclier = new THREE.Mesh(
    new THREE.ExtrudeGeometry(forme, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 3,
    }),
    new THREE.MeshStandardMaterial({ color: 0xb9ff66, roughness: 0.38 }),
  );
  bouclier.castShadow = true;
  groupe.add(bouclier);

  const coche = creerEtiquette(THREE, "✓", "#191a23", "#b9ff66");
  coche.position.set(0, 0.02, 0.16);
  coche.scale.setScalar(0.55);
  groupe.add(coche);
  return groupe;
}

function creerCadenas(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const corps = new THREE.Mesh(
    geometrieCarte(THREE, 0.95, 0.78, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xc24e2d, roughness: 0.42 }),
  );
  corps.castShadow = true;
  groupe.add(corps);

  const anse = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 12, 40, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x191a23, roughness: 0.32, metalness: 0.35 }),
  );
  anse.position.y = 0.42;
  groupe.add(anse);

  const trou = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.32, 20),
    new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.4 }),
  );
  trou.rotation.x = Math.PI / 2;
  trou.position.z = 0.16;
  groupe.add(trou);
  groupe.rotation.y = -0.12;
  return groupe;
}

function creerPersonne(THREE: ModuleThree, couleur: number, nom: string) {
  const groupe = new THREE.Group();
  const tete = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.5 }),
  );
  tete.position.y = 0.48;
  tete.castShadow = true;
  groupe.add(tete);

  const corps = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.48, 8, 18),
    new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.48 }),
  );
  corps.position.y = -0.18;
  corps.castShadow = true;
  groupe.add(corps);

  const etiquette = creerEtiquette(THREE, nom, "#f3f3f3", "#191a23");
  etiquette.position.set(0, -0.78, 0.24);
  etiquette.scale.setScalar(0.58);
  groupe.add(etiquette);
  return groupe;
}

function geometrieCarte(
  THREE: ModuleThree,
  largeur: number,
  hauteur: number,
  profondeur: number,
) {
  const x = -largeur / 2;
  const y = -hauteur / 2;
  const rayon = Math.min(0.09, hauteur / 4);
  const forme = new THREE.Shape();
  forme.moveTo(x + rayon, y);
  forme.lineTo(x + largeur - rayon, y);
  forme.quadraticCurveTo(x + largeur, y, x + largeur, y + rayon);
  forme.lineTo(x + largeur, y + hauteur - rayon);
  forme.quadraticCurveTo(x + largeur, y + hauteur, x + largeur - rayon, y + hauteur);
  forme.lineTo(x + rayon, y + hauteur);
  forme.quadraticCurveTo(x, y + hauteur, x, y + hauteur - rayon);
  forme.lineTo(x, y + rayon);
  forme.quadraticCurveTo(x, y, x + rayon, y);

  const geometrie = new THREE.ExtrudeGeometry(forme, {
    depth: profondeur,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  geometrie.center();
  return geometrie;
}

function creerEtiquette(
  THREE: ModuleThree,
  texte: string,
  fond: string,
  couleurTexte: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const contexte = canvas.getContext("2d");
  if (contexte) {
    contexte.fillStyle = fond;
    contexte.fillRect(0, 0, canvas.width, canvas.height);
    contexte.fillStyle = couleurTexte;
    contexte.font = "700 42px Arial, sans-serif";
    contexte.textAlign = "center";
    contexte.textBaseline = "middle";
    contexte.fillText(texte, canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 0.39),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
}

function creerTextureMiniTicket(THREE: ModuleThree, code: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 384;
  const contexte = canvas.getContext("2d");
  if (contexte) {
    contexte.fillStyle = "#fbf8f0";
    contexte.fillRect(0, 0, canvas.width, canvas.height);
    contexte.fillStyle = "#191a23";
    contexte.font = "700 32px Arial, sans-serif";
    contexte.fillText("WI-FI HOTSPOT", 30, 54);
    contexte.fillStyle = "#4d7c0f";
    contexte.font = "700 58px 'Courier New', monospace";
    contexte.fillText(code, 30, 158);
    contexte.strokeStyle = "#191a23";
    contexte.setLineDash([12, 10]);
    contexte.lineWidth = 3;
    contexte.beginPath();
    contexte.moveTo(26, 224);
    contexte.lineTo(614, 224);
    contexte.stroke();
    contexte.setLineDash([]);
    contexte.fillStyle = "#5a657d";
    contexte.font = "500 27px Arial, sans-serif";
    contexte.fillText("Identifiant = mot de passe", 30, 292);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function creerTexturePDF(THREE: ModuleThree) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 680;
  const contexte = canvas.getContext("2d");
  if (contexte) {
    contexte.fillStyle = "#fbf8f0";
    contexte.fillRect(0, 0, canvas.width, canvas.height);
    contexte.fillStyle = "#c24e2d";
    contexte.fillRect(0, 0, canvas.width, 104);
    contexte.fillStyle = "#f3f3f3";
    contexte.font = "700 52px Arial, sans-serif";
    contexte.fillText("PDF", 30, 68);
    contexte.fillStyle = "#191a23";
    contexte.font = "700 31px Arial, sans-serif";
    contexte.fillText("Tickets Hotspot", 30, 166);
    contexte.font = "500 25px Arial, sans-serif";
    contexte.fillStyle = "#5a657d";
    contexte.fillText("Lot prêt à imprimer", 30, 208);
    for (let i = 0; i < 5; i++) {
      const y = 258 + i * 72;
      contexte.strokeStyle = "#ddd4bc";
      contexte.strokeRect(30, y, 452, 54);
      contexte.fillStyle = i % 2 === 0 ? "#4d7c0f" : "#191a23";
      contexte.beginPath();
      contexte.arc(58, y + 27, 9, 0, Math.PI * 2);
      contexte.fill();
      contexte.fillStyle = "#191a23";
      contexte.font = "700 25px 'Courier New', monospace";
      contexte.fillText(`ticket_${2480 + i * 137}`, 82, y + 36);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
