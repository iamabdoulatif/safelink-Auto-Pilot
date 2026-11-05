"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

// Animation Three.js du hero : routeur MikroTik stylisé construit en code.
// Aucune image externe : boîtier, ports Ethernet, antennes, LED et ondes
// Wi-Fi sont des formes 3D, donc l'animation reste légère et nette.
type ModuleThree = typeof import("three");

export function RouteurMikrotik3D() {
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    let nettoyer: () => void = () => undefined;

    import("three")
      .then((THREE) => {
        if (annule || !conteneurRef.current) return;
        nettoyer = initialiserScene(THREE, conteneurRef.current, {
          onPret: () => setPret(true),
          onErreur: () => setErreur(true),
        });
      })
      .catch(() => setErreur(true));

    return () => {
      annule = true;
      nettoyer();
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/25">
      <div
        ref={conteneurRef}
        role="img"
        aria-label="Animation 3D d'un routeur MikroTik avec antennes, ports Ethernet et LED réseau"
        className="h-72 w-full cursor-grab active:cursor-grabbing sm:h-80"
      />
      {!pret && !erreur ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-sidebar-foreground/70">
          Chargement du routeur 3D…
        </p>
      ) : null}
      {erreur ? (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-sidebar-foreground/80">
          Le modèle 3D n’a pas pu démarrer sur ce navigateur.
        </p>
      ) : null}
      <div className="pointer-events-none absolute top-3 left-3 flex gap-2">
        <Badge variant="secondary">MikroTik 3D</Badge>
        <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground">
          LED réseau
        </Badge>
      </div>
      <p className="pointer-events-none absolute right-3 bottom-3 left-3 text-xs text-sidebar-foreground/70">
        Routeur stylisé : boîtier, 5 ports Ethernet, antennes et signal Wi-Fi animés.
      </p>
    </div>
  );
}

function initialiserScene(
  THREE: ModuleThree,
  conteneur: HTMLDivElement,
  callbacks: { onPret: () => void; onErreur: () => void },
) {
  let renderer: InstanceType<ModuleThree["WebGLRenderer"]> | null = null;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    callbacks.onErreur();
    return () => undefined;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(5.4, 3.6, 6.4);
  camera.lookAt(0, 0.55, 0);

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

  const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const routeur = creerRouteur(THREE);
  scene.add(routeur.groupe);
  scene.add(creerDecor(THREE));

  const lumiereHemisphere = new THREE.HemisphereLight(0xf4efe3, 0x24304a, 1.8);
  scene.add(lumiereHemisphere);

  const lumierePrincipale = new THREE.DirectionalLight(0xf4efe3, 2.6);
  lumierePrincipale.position.set(4, 7, 5);
  lumierePrincipale.castShadow = true;
  lumierePrincipale.shadow.mapSize.set(1024, 1024);
  lumierePrincipale.shadow.camera.left = -6;
  lumierePrincipale.shadow.camera.right = 6;
  lumierePrincipale.shadow.camera.top = 6;
  lumierePrincipale.shadow.camera.bottom = -6;
  scene.add(lumierePrincipale);

  const lumiereSignal = new THREE.DirectionalLight(0x1e9e6a, 1.1);
  lumiereSignal.position.set(-5, 3, -4);
  scene.add(lumiereSignal);

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
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(conteneur);
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
  let premierRendu = true;

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const temps = horloge.getElapsedTime();
    const vitesse = mouvementReduit ? 0 : 1;

    souris.x += (souris.cibleX - souris.x) * 0.045;
    souris.y += (souris.cibleY - souris.y) * 0.045;

    routeur.groupe.rotation.y = Math.sin(temps * 0.45) * 0.2 * vitesse + souris.x * 0.38;
    routeur.groupe.rotation.x = Math.sin(temps * 0.32) * 0.025 * vitesse - souris.y * 0.1;
    routeur.groupe.position.y = Math.sin(temps * 1.15) * 0.055 * vitesse;

    for (const led of routeur.leds) {
      led.material.emissiveIntensity =
        led.base + (Math.sin(temps * 3.2 + led.phase) * 0.5 + 0.5) * 1.15 * vitesse;
    }
    routeur.ondes.children.forEach((enfant, index) => {
      const arc = enfant as InstanceType<ModuleThree["Mesh"]>;
      const material = arc.material as InstanceType<ModuleThree["MeshBasicMaterial"]>;
      material.opacity = mouvementReduit ? 0.75 : 0.38 + (Math.sin(temps * 2 + index * 0.75) * 0.5 + 0.5) * 0.45;
      const echelle = 1 + Math.sin(temps * 2 + index * 0.75) * 0.025 * vitesse;
      arc.scale.setScalar(echelle);
    });
    routeur.anneaux.forEach((anneau, index) => {
      const progression = mouvementReduit ? 0.35 : (temps * 0.28 + index / routeur.anneaux.length) % 1;
      anneau.scale.setScalar(1 + progression * 0.75);
      const material = anneau.material as InstanceType<ModuleThree["MeshBasicMaterial"]>;
      material.opacity = 0.2 * (1 - progression);
    });

    renderer?.render(scene, camera);
    if (premierRendu) {
      premierRendu = false;
      callbacks.onPret();
    }
  });

  return () => {
    observateur.disconnect();
    observateurVisibilite.disconnect();
    conteneur.removeEventListener("pointermove", onPointerMove);
    conteneur.removeEventListener("pointerleave", onPointerLeave);
    renderer?.setAnimationLoop(null);
    scene.traverse((objet) => {
      const mesh = objet as Partial<InstanceType<ModuleThree["Mesh"]>>;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
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

function creerRouteur(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const leds: Array<{
    material: InstanceType<ModuleThree["MeshStandardMaterial"]>;
    phase: number;
    base: number;
  }> = [];

  const plastiqueCreme = new THREE.MeshStandardMaterial({
    color: 0xf4efe3,
    roughness: 0.42,
    metalness: 0.02,
  });
  const plastiqueBleu = new THREE.MeshStandardMaterial({
    color: 0x24304a,
    roughness: 0.48,
    metalness: 0.08,
  });
  const matiereSombre = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.58,
    metalness: 0.18,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0xd8cfb2,
    roughness: 0.28,
    metalness: 0.72,
  });

  const boitier = new THREE.Mesh(geometrieBoitier(THREE, 4.8, 3.05, 0.58), plastiqueCreme);
  boitier.castShadow = true;
  boitier.receiveShadow = true;
  groupe.add(boitier);

  const dessus = new THREE.Mesh(geometrieBoitier(THREE, 4.35, 2.62, 0.1), plastiqueCreme);
  dessus.position.y = 0.33;
  dessus.castShadow = true;
  groupe.add(dessus);

  const etiquette = new THREE.Mesh(
    new THREE.PlaneGeometry(2.75, 1.18),
    new THREE.MeshStandardMaterial({
      map: creerTextureEtiquette(THREE),
      roughness: 0.5,
      metalness: 0,
      transparent: true,
    }),
  );
  etiquette.rotation.x = -Math.PI / 2;
  etiquette.position.set(-0.55, 0.44, 0.12);
  groupe.add(etiquette);

  for (let i = 0; i < 7; i++) {
    const rainure = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 1.55), plastiqueBleu);
    rainure.position.set(1.15 + i * 0.16, 0.435, 0.05);
    rainure.material = plastiqueBleu;
    rainure.material.opacity = 0.22;
    rainure.material.transparent = true;
    groupe.add(rainure);
  }

  for (let i = 0; i < 5; i++) {
    const x = -1.72 + i * 0.72;
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.07), matiereSombre);
    port.position.set(x, -0.03, 1.545);
    groupe.add(port);

    const contact = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.025), metal);
    contact.position.set(x, -0.1, 1.585);
    groupe.add(contact);

    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e9e6a,
      emissive: 0x1e9e6a,
      emissiveIntensity: 1,
      roughness: 0.25,
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), ledMaterial);
    led.position.set(x, 0.2, 1.575);
    groupe.add(led);
    leds.push({ material: ledMaterial, phase: i * 0.85, base: 0.7 });
  }

  const ledAlerteMaterial = new THREE.MeshStandardMaterial({
    color: 0xc24e2d,
    emissive: 0xc24e2d,
    emissiveIntensity: 0.8,
    roughness: 0.25,
  });
  const ledAlerte = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), ledAlerteMaterial);
  ledAlerte.position.set(2.08, 0.2, 1.575);
  groupe.add(ledAlerte);
  leds.push({ material: ledAlerteMaterial, phase: 2.4, base: 0.35 });

  groupe.add(creerAntenne(THREE, -2.05, -1.05, 0.12));
  groupe.add(creerAntenne(THREE, 2.05, -1.05, -0.12));
  groupe.add(creerCable(THREE, matiereSombre));

  const ondes = creerOndes(THREE);
  ondes.position.set(0, 1.05, 0.68);
  groupe.add(ondes);

  const anneaux = creerAnneaux(THREE);
  groupe.add(anneaux.groupe);

  groupe.rotation.y = -0.18;
  return { groupe, leds, ondes, anneaux: anneaux.elements };
}

function creerAntenne(THREE: ModuleThree, x: number, z: number, inclinaison: number) {
  const groupe = new THREE.Group();
  const matiere = new THREE.MeshStandardMaterial({
    color: 0x24304a,
    roughness: 0.45,
    metalness: 0.12,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 24), matiere);
  base.position.y = 0.36;
  base.castShadow = true;
  groupe.add(base);

  const tige = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 1.05, 6, 16), matiere);
  tige.position.y = 1.02;
  tige.castShadow = true;
  groupe.add(tige);

  const embout = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), matiere);
  embout.position.y = 1.62;
  groupe.add(embout);

  groupe.position.set(x, 0.05, z);
  groupe.rotation.z = inclinaison;
  groupe.rotation.x = -0.1;
  return groupe;
}

function creerCable(
  THREE: ModuleThree,
  material: InstanceType<ModuleThree["MeshStandardMaterial"]>,
) {
  const courbe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.62, -0.05, 1.58),
    new THREE.Vector3(2.35, -0.28, 2.05),
    new THREE.Vector3(3.05, -0.58, 1.55),
    new THREE.Vector3(3.85, -0.62, 2.1),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(courbe, 36, 0.038, 10), material);
  cable.castShadow = true;
  return cable;
}

function creerOndes(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x1e9e6a }),
  );
  point.position.y = -0.35;
  groupe.add(point);

  [0.48, 0.82, 1.16].forEach((rayon) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x1e9e6a,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(rayon, 0.034, 10, 56, Math.PI * 0.82),
      material,
    );
    arc.rotation.z = Math.PI * 0.09;
    groupe.add(arc);
  });
  return groupe;
}

function creerAnneaux(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const elements: Array<InstanceType<ModuleThree["Mesh"]>> = [];
  for (let i = 0; i < 2; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x1e9e6a,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const anneau = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.6, 96), material);
    anneau.rotation.x = -Math.PI / 2;
    anneau.position.y = -0.61;
    groupe.add(anneau);
    elements.push(anneau);
  }
  return { groupe, elements };
}

function creerDecor(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const disque = new THREE.Mesh(
    new THREE.CircleGeometry(3.35, 72),
    new THREE.MeshBasicMaterial({
      color: 0x1e9e6a,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    }),
  );
  disque.rotation.x = -Math.PI / 2;
  disque.position.y = -0.64;
  groupe.add(disque);

  const ombre = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.ShadowMaterial({ opacity: 0.24 }),
  );
  ombre.rotation.x = -Math.PI / 2;
  ombre.position.y = -0.63;
  ombre.receiveShadow = true;
  groupe.add(ombre);
  return groupe;
}

function geometrieBoitier(
  THREE: ModuleThree,
  largeur: number,
  profondeur: number,
  hauteur: number,
) {
  const x = -largeur / 2;
  const y = -profondeur / 2;
  const rayon = 0.26;
  const forme = new THREE.Shape();
  forme.moveTo(x + rayon, y);
  forme.lineTo(x + largeur - rayon, y);
  forme.quadraticCurveTo(x + largeur, y, x + largeur, y + rayon);
  forme.lineTo(x + largeur, y + profondeur - rayon);
  forme.quadraticCurveTo(x + largeur, y + profondeur, x + largeur - rayon, y + profondeur);
  forme.lineTo(x + rayon, y + profondeur);
  forme.quadraticCurveTo(x, y + profondeur, x, y + profondeur - rayon);
  forme.lineTo(x, y + rayon);
  forme.quadraticCurveTo(x, y, x + rayon, y);

  const geometrie = new THREE.ExtrudeGeometry(forme, {
    depth: hauteur,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  geometrie.rotateX(-Math.PI / 2);
  geometrie.center();
  return geometrie;
}

function creerTextureEtiquette(THREE: ModuleThree) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 440;
  const contexte = canvas.getContext("2d");
  if (!contexte) return new THREE.CanvasTexture(canvas);

  contexte.clearRect(0, 0, canvas.width, canvas.height);
  contexte.fillStyle = "#24304a";
  contexte.font = "700 118px Arial, sans-serif";
  contexte.textAlign = "left";
  contexte.textBaseline = "middle";
  contexte.fillText("MikroTik", 42, 150);

  contexte.fillStyle = "#1e9e6a";
  contexte.font = "700 44px Arial, sans-serif";
  contexte.fillText("SAFELINK AUTO-PILOT", 46, 255);

  contexte.fillStyle = "#24304a";
  contexte.font = "500 34px Arial, sans-serif";
  contexte.fillText("Routeur surveillé • Tickets Hotspot", 46, 330);

  contexte.beginPath();
  contexte.arc(900, 128, 54, 0, Math.PI * 2);
  contexte.fillStyle = "#1e9e6a";
  contexte.fill();
  contexte.fillStyle = "#f4efe3";
  contexte.font = "700 48px Arial, sans-serif";
  contexte.textAlign = "center";
  contexte.fillText("5G", 900, 130);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
