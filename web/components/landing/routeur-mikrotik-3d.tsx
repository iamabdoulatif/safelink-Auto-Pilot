"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

// Animation Three.js du hero : routeur MikroTik, tickets Hotspot,
// interface Mikhmon et câble RJ45 construits en code, sans image externe.
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
        aria-label="Animation 3D d'un routeur MikroTik branché en RJ45, avec tickets Hotspot et interface Mikhmon"
        className="h-80 w-full cursor-grab active:cursor-grabbing sm:h-96"
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
      <div className="pointer-events-none absolute top-3 left-3 flex max-w-full flex-wrap gap-2 pr-3">
        <Badge variant="secondary">MikroTik 3D</Badge>
        <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground">
          Tickets 3D
        </Badge>
        <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground">
          Mikhmon 3D
        </Badge>
        <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground">
          RJ45 branché
        </Badge>
      </div>
      <p className="pointer-events-none absolute right-3 bottom-3 left-3 text-xs text-sidebar-foreground/70">
        Routeur, tickets Hotspot, interface Mikhmon et câble RJ45 animés en 3D.
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
  camera.position.set(6.1, 4.0, 7.3);
  camera.lookAt(0, 0.65, 0);

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

  const lumiereHemisphere = new THREE.HemisphereLight(0xf3f3f3, 0x191a23, 1.8);
  scene.add(lumiereHemisphere);

  const lumierePrincipale = new THREE.DirectionalLight(0xf3f3f3, 2.6);
  lumierePrincipale.position.set(4, 7, 5);
  lumierePrincipale.castShadow = true;
  lumierePrincipale.shadow.mapSize.set(1024, 1024);
  lumierePrincipale.shadow.camera.left = -6;
  lumierePrincipale.shadow.camera.right = 6;
  lumierePrincipale.shadow.camera.top = 6;
  lumierePrincipale.shadow.camera.bottom = -6;
  scene.add(lumierePrincipale);

  const lumiereSignal = new THREE.DirectionalLight(0xb9ff66, 1.1);
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
    routeur.tickets.forEach((ticket) => {
      ticket.groupe.position.y =
        ticket.baseY + Math.sin(temps * 1.35 + ticket.phase) * 0.085 * vitesse;
      ticket.groupe.rotation.y =
        ticket.baseRotationY + Math.sin(temps * 0.75 + ticket.phase) * 0.16 * vitesse;
      ticket.groupe.rotation.z =
        ticket.baseRotationZ + Math.sin(temps * 0.9 + ticket.phase) * 0.045 * vitesse;
    });
    if (routeur.panneau) {
      routeur.panneau.groupe.position.y =
        routeur.panneau.baseY + Math.sin(temps * 0.85 + 1.2) * 0.045 * vitesse;
      routeur.panneau.groupe.rotation.y =
        routeur.panneau.baseRotationY + Math.sin(temps * 0.5) * 0.035 * vitesse;
    }
    if (routeur.courbeRJ45 && routeur.impulsionRJ45) {
      const progression = mouvementReduit ? 0.45 : (temps * 0.22) % 1;
      routeur.impulsionRJ45.position.copy(routeur.courbeRJ45.getPointAt(progression));
      const matiere = routeur.impulsionRJ45.material as InstanceType<
        ModuleThree["MeshStandardMaterial"]
      >;
      matiere.emissiveIntensity = 1.4 + Math.sin(temps * 5) * 0.45 * vitesse;
    }

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
    color: 0xf3f3f3,
    roughness: 0.42,
    metalness: 0.02,
  });
  const plastiqueBleu = new THREE.MeshStandardMaterial({
    color: 0x191a23,
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
      color: 0xb9ff66,
      emissive: 0xb9ff66,
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

  const cableRJ45 = creerCableRJ45(THREE, matiereSombre, metal);
  groupe.add(cableRJ45.groupe);

  const panneau = creerPanneauMikhmon(THREE);
  groupe.add(panneau.groupe);

  const tickets = creerTickets(THREE);
  tickets.forEach((ticket) => groupe.add(ticket.groupe));

  const ondes = creerOndes(THREE);
  ondes.position.set(0, 1.05, 0.68);
  groupe.add(ondes);

  const anneaux = creerAnneaux(THREE);
  groupe.add(anneaux.groupe);

  groupe.rotation.y = -0.18;
  return {
    groupe,
    leds,
    ondes,
    anneaux: anneaux.elements,
    tickets,
    panneau,
    courbeRJ45: cableRJ45.courbe,
    impulsionRJ45: cableRJ45.impulsion,
  };
}

function creerAntenne(THREE: ModuleThree, x: number, z: number, inclinaison: number) {
  const groupe = new THREE.Group();
  const matiere = new THREE.MeshStandardMaterial({
    color: 0x191a23,
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

function creerCableRJ45(
  THREE: ModuleThree,
  matiereSombre: InstanceType<ModuleThree["MeshStandardMaterial"]>,
  metal: InstanceType<ModuleThree["MeshStandardMaterial"]>,
) {
  const groupe = new THREE.Group();
  const portX = 1.16;

  // Fiche RJ45 réellement enfoncée dans le 5e port du routeur.
  const fiche = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.26, 0.52),
    new THREE.MeshStandardMaterial({
      color: 0xf3f3f3,
      roughness: 0.22,
      metalness: 0.02,
      transparent: true,
      opacity: 0.82,
    }),
  );
  fiche.position.set(portX, -0.03, 1.82);
  fiche.castShadow = true;
  groupe.add(fiche);

  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.34), matiereSombre);
  clip.position.set(portX, 0.13, 1.86);
  clip.rotation.x = -0.18;
  groupe.add(clip);

  [-0.09, -0.03, 0.03, 0.09].forEach((decalage, index) => {
    const couleur = [0xb9ff66, 0xf3f3f3, 0x191a23, 0xc24e2d][index] ?? 0xb9ff66;
    const fil = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.16, 0.03),
      new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.45 }),
    );
    fil.position.set(portX + decalage, -0.03, 1.6);
    groupe.add(fil);
  });

  const contacts = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.05), metal);
  contacts.position.set(portX, 0.07, 1.58);
  groupe.add(contacts);

  const manchon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.14, 0.42, 20),
    matiereSombre,
  );
  manchon.rotation.x = Math.PI / 2;
  manchon.position.set(portX, -0.03, 2.24);
  manchon.castShadow = true;
  groupe.add(manchon);

  const courbe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(portX, -0.03, 2.42),
    new THREE.Vector3(1.85, -0.3, 2.75),
    new THREE.Vector3(2.85, -0.58, 2.15),
    new THREE.Vector3(3.9, -0.62, 2.65),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(courbe, 42, 0.048, 12), matiereSombre);
  cable.castShadow = true;
  groupe.add(cable);

  const impulsion = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 18),
    new THREE.MeshStandardMaterial({
      color: 0xb9ff66,
      emissive: 0xb9ff66,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    }),
  );
  groupe.add(impulsion);

  return { groupe, courbe, impulsion };
}

function creerPanneauMikhmon(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const cadre = new THREE.Mesh(
    new THREE.BoxGeometry(2.75, 1.72, 0.09),
    new THREE.MeshStandardMaterial({
      color: 0x191a23,
      roughness: 0.38,
      metalness: 0.12,
    }),
  );
  cadre.castShadow = true;
  groupe.add(cadre);

  const ecran = new THREE.Mesh(
    new THREE.PlaneGeometry(2.56, 1.54),
    new THREE.MeshStandardMaterial({
      map: creerTextureMikhmon(THREE),
      roughness: 0.32,
      metalness: 0,
    }),
  );
  ecran.position.z = 0.052;
  groupe.add(ecran);

  const voyant = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xb9ff66,
      emissive: 0xb9ff66,
      emissiveIntensity: 1.5,
    }),
  );
  voyant.position.set(1.22, 0.72, 0.08);
  groupe.add(voyant);

  groupe.position.set(2.05, 1.52, -1.18);
  groupe.rotation.set(-0.06, -0.28, 0.02);
  return { groupe, baseY: 1.52, baseRotationY: -0.28 };
}

function creerTickets(THREE: ModuleThree) {
  const definitions = [
    { code: "10j48372", duree: "10 JOURS", x: -2.78, y: 0.72, z: 1.05, rotY: 0.52, rotZ: -0.1, phase: 0.4 },
    { code: "1j638291", duree: "1 JOUR", x: 2.82, y: 0.48, z: 1.18, rotY: -0.5, rotZ: 0.09, phase: 1.7 },
    { code: "7j205914", duree: "7 JOURS", x: -2.28, y: 1.86, z: -0.35, rotY: 0.34, rotZ: 0.06, phase: 2.8 },
  ];

  return definitions.map((definition) => {
    const groupe = new THREE.Group();
    const corps = new THREE.Mesh(
      geometrieTicket(THREE),
      new THREE.MeshStandardMaterial({
        color: 0xfbf8f0,
        roughness: 0.48,
        metalness: 0.01,
      }),
    );
    corps.castShadow = true;
    groupe.add(corps);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.22, 0.74),
      new THREE.MeshStandardMaterial({
        map: creerTextureTicket(THREE, definition.code, definition.duree),
        roughness: 0.5,
        transparent: true,
      }),
    );
    face.position.z = 0.037;
    groupe.add(face);

    groupe.position.set(definition.x, definition.y, definition.z);
    groupe.rotation.set(-0.08, definition.rotY, definition.rotZ);
    return {
      groupe,
      baseY: definition.y,
      baseRotationY: definition.rotY,
      baseRotationZ: definition.rotZ,
      phase: definition.phase,
    };
  });
}

function creerOndes(THREE: ModuleThree) {
  const groupe = new THREE.Group();
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xb9ff66 }),
  );
  point.position.y = -0.35;
  groupe.add(point);

  [0.48, 0.82, 1.16].forEach((rayon) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xb9ff66,
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
      color: 0xb9ff66,
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
      color: 0xb9ff66,
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
  contexte.fillStyle = "#191a23";
  contexte.font = "700 118px Arial, sans-serif";
  contexte.textAlign = "left";
  contexte.textBaseline = "middle";
  contexte.fillText("MikroTik", 42, 150);

  contexte.fillStyle = "#4d7c0f";
  contexte.font = "700 44px Arial, sans-serif";
  contexte.fillText("SAFELINK AUTO-PILOT", 46, 255);

  contexte.fillStyle = "#191a23";
  contexte.font = "500 34px Arial, sans-serif";
  contexte.fillText("Routeur surveillé • Tickets Hotspot", 46, 330);

  contexte.beginPath();
  contexte.arc(900, 128, 54, 0, Math.PI * 2);
  contexte.fillStyle = "#4d7c0f";
  contexte.fill();
  contexte.fillStyle = "#f3f3f3";
  contexte.font = "700 48px Arial, sans-serif";
  contexte.textAlign = "center";
  contexte.fillText("5G", 900, 130);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function geometrieTicket(THREE: ModuleThree) {
  const largeur = 1.3;
  const hauteur = 0.82;
  const x = -largeur / 2;
  const y = -hauteur / 2;
  const rayon = 0.09;
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
    depth: 0.045,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  geometrie.center();
  return geometrie;
}

function creerTextureTicket(THREE: ModuleThree, code: string, duree: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const contexte = canvas.getContext("2d");
  if (!contexte) return new THREE.CanvasTexture(canvas);

  contexte.fillStyle = "#fbf8f0";
  contexte.fillRect(0, 0, canvas.width, canvas.height);
  contexte.fillStyle = "#191a23";
  contexte.font = "700 34px Arial, sans-serif";
  contexte.textAlign = "left";
  contexte.fillText("WI-FI HOTSPOT", 34, 58);
  contexte.textAlign = "right";
  contexte.fillStyle = "#4d7c0f";
  contexte.fillText(duree, 606, 58);

  contexte.fillStyle = "#191a23";
  contexte.font = "700 82px 'Courier New', monospace";
  contexte.textAlign = "left";
  contexte.fillText(code, 34, 178);

  contexte.strokeStyle = "#191a23";
  contexte.setLineDash([12, 10]);
  contexte.lineWidth = 3;
  contexte.beginPath();
  contexte.moveTo(28, 248);
  contexte.lineTo(612, 248);
  contexte.stroke();
  contexte.setLineDash([]);

  contexte.fillStyle = "#5a657d";
  contexte.font = "500 30px Arial, sans-serif";
  contexte.fillText("Identifiant = mot de passe", 34, 312);
  contexte.fillStyle = "#4d7c0f";
  contexte.beginPath();
  contexte.arc(574, 318, 18, 0, Math.PI * 2);
  contexte.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function creerTextureMikhmon(THREE: ModuleThree) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const contexte = canvas.getContext("2d");
  if (!contexte) return new THREE.CanvasTexture(canvas);

  contexte.fillStyle = "#f3f3f3";
  contexte.fillRect(0, 0, canvas.width, canvas.height);
  contexte.fillStyle = "#191a23";
  contexte.fillRect(0, 0, canvas.width, 86);
  contexte.fillStyle = "#f3f3f3";
  contexte.font = "700 42px Arial, sans-serif";
  contexte.fillText("Mikhmon", 30, 56);
  contexte.font = "500 24px Arial, sans-serif";
  contexte.fillText("Hotspot Manager", 245, 55);
  contexte.fillStyle = "#4d7c0f";
  contexte.beginPath();
  contexte.arc(958, 43, 17, 0, Math.PI * 2);
  contexte.fill();

  contexte.fillStyle = "#191a23";
  contexte.fillRect(0, 86, 218, 554);
  contexte.fillStyle = "#f3f3f3";
  contexte.font = "600 26px Arial, sans-serif";
  ["Dashboard", "Hotspot", "Users", "Vouchers", "Generate", "Log"].forEach((item, index) => {
    if (index === 3) {
      contexte.fillStyle = "#4d7c0f";
      contexte.fillRect(14, 122 + index * 62, 190, 44);
      contexte.fillStyle = "#f3f3f3";
    }
    contexte.fillText(item, 30, 152 + index * 62);
    contexte.fillStyle = "#f3f3f3";
  });

  const cartes = [
    { titre: "Actifs", valeur: "128", couleur: "#4d7c0f" },
    { titre: "Tickets 1J", valeur: "342", couleur: "#191a23" },
    { titre: "Tickets 10J", valeur: "96", couleur: "#c24e2d" },
  ];
  cartes.forEach((carte, index) => {
    const x = 246 + index * 252;
    contexte.fillStyle = "#fbf8f0";
    contexte.fillRect(x, 116, 228, 118);
    contexte.strokeStyle = "#ddd4bc";
    contexte.strokeRect(x, 116, 228, 118);
    contexte.fillStyle = carte.couleur;
    contexte.beginPath();
    contexte.arc(x + 28, 148, 10, 0, Math.PI * 2);
    contexte.fill();
    contexte.fillStyle = "#5a657d";
    contexte.font = "600 22px Arial, sans-serif";
    contexte.fillText(carte.titre, x + 48, 156);
    contexte.fillStyle = "#191a23";
    contexte.font = "700 46px Arial, sans-serif";
    contexte.fillText(carte.valeur, x + 24, 212);
  });

  contexte.fillStyle = "#191a23";
  contexte.font = "700 27px Arial, sans-serif";
  contexte.fillText("Derniers vouchers générés", 246, 292);
  const lignes = [
    ["10j48372", "10 jours", "#4d7c0f"],
    ["1j638291", "1 jour", "#4d7c0f"],
    ["7j205914", "7 jours", "#c24e2d"],
    ["1j771204", "1 jour", "#191a23"],
  ] as const;
  lignes.forEach(([code, duree, couleur], index) => {
    const y = 326 + index * 68;
    contexte.fillStyle = "#fbf8f0";
    contexte.fillRect(246, y, 724, 52);
    contexte.strokeStyle = "#ddd4bc";
    contexte.strokeRect(246, y, 724, 52);
    contexte.fillStyle = couleur;
    contexte.beginPath();
    contexte.arc(274, y + 26, 9, 0, Math.PI * 2);
    contexte.fill();
    contexte.fillStyle = "#191a23";
    contexte.font = "700 27px 'Courier New', monospace";
    contexte.fillText(code, 302, y + 35);
    contexte.font = "500 24px Arial, sans-serif";
    contexte.fillStyle = "#5a657d";
    contexte.fillText(duree, 520, y + 35);
    contexte.fillText("Mikhmon", 760, y + 35);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
