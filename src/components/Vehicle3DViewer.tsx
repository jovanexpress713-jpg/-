import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import {
  APPROVED_VEHICLE_TYPES_LIST,
  getVehicleTypeMeta,
  normalizeVehicleType,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";
import {
  IconZoomIn,
  IconZoomOut,
  IconTruck,
} from "./Icons";

interface Vehicle3DViewerProps {
  vehicleType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  previewMode?: boolean; // If true: allows carousel switching. If false: locked to real vehicle type.
  onTypeChange?: (newType: CanonicalVehicleTypeId) => void;
  className?: string;
  compact?: boolean;
  showControls?: boolean;
  height?: string | number;
}

export function Vehicle3DViewer({
  vehicleType = "curtain",
  vehicleModel,
  vehiclePlate,
  previewMode = false,
  onTypeChange,
  className,
  compact = false,
  showControls = true,
  height = "100%",
}: Vehicle3DViewerProps) {
  const { t } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active vehicle type in viewer
  const [activeType, setActiveType] = useState<CanonicalVehicleTypeId>(() =>
    normalizeVehicleType(vehicleType)
  );

  // Sync when prop changes
  useEffect(() => {
    setActiveType(normalizeVehicleType(vehicleType));
  }, [vehicleType]);

  const [autoRotate, setAutoRotate] = useState(true);
  const [glSupported, setGlSupported] = useState(true);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const truckGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 24, theta: 0.85, phi: 1.1 }); // 3/4 front view
  const targetLookAtRef = useRef(new THREE.Vector3(0, 2.8, 0));

  // Default camera reset
  const resetCamera = useCallback(() => {
    sphericalRef.current = { radius: compact ? 26 : 22, theta: 0.85, phi: 1.1 };
    targetLookAtRef.current.set(0, 2.8, 0);
  }, [compact]);

  const zoomIn = useCallback(() => {
    sphericalRef.current.radius = Math.max(14, sphericalRef.current.radius - 3);
  }, []);

  const zoomOut = useCallback(() => {
    sphericalRef.current.radius = Math.min(36, sphericalRef.current.radius + 3);
  }, []);

  // Handler for carousel type switch
  const handleSelectType = useCallback(
    (typeId: CanonicalVehicleTypeId) => {
      setActiveType(typeId);
      if (onTypeChange) onTypeChange(typeId);
    },
    [onTypeChange]
  );

  // Build Procedural 3D Truck Model matching the selected type
  const buildTruckModel = useCallback((typeId: CanonicalVehicleTypeId): THREE.Group => {
    const truck = new THREE.Group();

    // Materials
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x182436,
      roughness: 0.5,
      metalness: 0.7,
    });

    // Cab Paint: Silver Metallic (matching user reference photo for Flatbed) or EJAZ Orange
    const isFlatbedRef = typeId === "flatbed";
    const cabPaintColor = isFlatbedRef ? 0xdce3eb : 0xff7a00;
    const cabPaintMat = new THREE.MeshPhysicalMaterial({
      color: cabPaintColor,
      roughness: isFlatbedRef ? 0.22 : 0.25,
      metalness: isFlatbedRef ? 0.65 : 0.35,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
    const cabAccentMat = new THREE.MeshStandardMaterial({
      color: isFlatbedRef ? 0x222a36 : 0x0a1931,
      roughness: 0.4,
      metalness: 0.6,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111c2e,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.15,
      metalness: 0.95,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x11141a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

    // Helper: Wheel Assembly (tire + rim + hub)
    const createWheel = () => {
      const wheel = new THREE.Group();
      // Tire
      const tireGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.7, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, rubberMat);
      wheel.add(tire);
      // Rim
      const rimGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.72, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, chromeMat);
      wheel.add(rim);
      // Hubcap accent
      const hubGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.76, 12);
      hubGeo.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, isFlatbedRef ? chromeMat : cabPaintMat);
      wheel.add(hub);
      return wheel;
    };

    // 1. Chassis Beams (Length 21 units)
    const chassisGeo = new THREE.BoxGeometry(21, 0.5, 2.6);
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 1.6, 0);
    truck.add(chassis);

    // Fuel Tanks & Exhaust (Cylinders on sides)
    const tankGeo = new THREE.CylinderGeometry(0.8, 0.8, 3.8, 16);
    tankGeo.rotateZ(Math.PI / 2);
    const leftTank = new THREE.Mesh(tankGeo, chromeMat);
    leftTank.position.set(3.8, 1.4, 1.6);
    truck.add(leftTank);

    const rightTank = new THREE.Mesh(tankGeo, chromeMat);
    rightTank.position.set(3.8, 1.4, -1.6);
    truck.add(rightTank);

    // 2. Wheels Placement
    // Front Steer Axle (under cab, x = 7.5)
    const wF1 = createWheel();
    wF1.position.set(7.5, 1.2, 1.6);
    truck.add(wF1);
    const wF2 = createWheel();
    wF2.position.set(7.5, 1.2, -1.6);
    truck.add(wF2);

    // Drive Axle 1 (x = 4.6)
    const wD1 = createWheel();
    wD1.position.set(4.6, 1.2, 1.6);
    truck.add(wD1);
    const wD2 = createWheel();
    wD2.position.set(4.6, 1.2, -1.6);
    truck.add(wD2);

    // Drive Axle 2 (Tandem 6x2/6x4 rear tractor axle as in photo, x = 2.6)
    const wD3 = createWheel();
    wD3.position.set(2.6, 1.2, 1.6);
    truck.add(wD3);
    const wD4 = createWheel();
    wD4.position.set(2.6, 1.2, -1.6);
    truck.add(wD4);

    // Trailer Triple Axles (rear: x = -5.0, -7.2, -9.4)
    [-5.0, -7.2, -9.4].forEach((pos) => {
      const wL = createWheel();
      wL.position.set(pos, 1.2, 1.6);
      truck.add(wL);
      const wR = createWheel();
      wR.position.set(pos, 1.2, -1.6);
      truck.add(wR);
    });

    // 3. Tractor Cabin (Actros GigaSpace Cabin matching reference photo)
    const cabGroup = new THREE.Group();
    cabGroup.position.set(6.8, 1.8, 0);

    // Main Cab Lower Body
    const cabLowerGeo = new THREE.BoxGeometry(4.2, 2.8, 3.4);
    const cabLower = new THREE.Mesh(cabLowerGeo, cabPaintMat);
    cabLower.position.set(0, 1.4, 0);
    cabGroup.add(cabLower);

    // Cab Upper Sleeper / GigaSpace High Roof
    const cabUpperGeo = new THREE.BoxGeometry(4.0, 2.2, 3.3);
    const cabUpper = new THREE.Mesh(cabUpperGeo, cabPaintMat);
    cabUpper.position.set(-0.1, 3.8, 0);
    cabGroup.add(cabUpper);

    // Aerodynamic Roof Fairing / Deflector
    const deflectorShape = new THREE.Shape();
    deflectorShape.moveTo(0, 0);
    deflectorShape.lineTo(2.2, 0);
    deflectorShape.lineTo(0.4, 1.2);
    deflectorShape.lineTo(0, 1.2);
    deflectorShape.closePath();
    const extrudeSettings = { depth: 3.2, bevelEnabled: false };
    const deflectorGeo = new THREE.ExtrudeGeometry(deflectorShape, extrudeSettings);
    deflectorGeo.center();
    const deflector = new THREE.Mesh(deflectorGeo, cabPaintMat);
    deflector.position.set(0.2, 5.3, 0);
    cabGroup.add(deflector);

    // Roof Clearance Marker Lights & Dual Antennas (as in photo)
    [-1.1, 1.1].forEach((rz) => {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.14), new THREE.MeshBasicMaterial({ color: 0xffaa22 }));
      marker.position.set(1.2, 5.65, rz);
      cabGroup.add(marker);

      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      ant.position.set(0.5, 6.2, rz);
      ant.rotation.z = -0.15;
      cabGroup.add(ant);
    });

    // Front Grille with Actros multi-slats
    const grilleGeo = new THREE.BoxGeometry(0.3, 2.0, 2.6);
    const grille = new THREE.Mesh(grilleGeo, cabAccentMat);
    grille.position.set(2.15, 1.6, 0);
    cabGroup.add(grille);

    // Horizontal Chrome Slats on Grille
    [-0.5, -0.15, 0.2, 0.55].forEach((gy) => {
      const slatGeo = new THREE.BoxGeometry(0.1, 0.06, 2.4);
      const slat = new THREE.Mesh(slatGeo, chromeMat);
      slat.position.set(2.28, 1.8 + gy, 0);
      cabGroup.add(slat);
    });

    // Mercedes-Benz Three-Pointed Star (Center of Grille)
    const starRingGeo = new THREE.TorusGeometry(0.32, 0.035, 12, 32);
    starRingGeo.rotateY(Math.PI / 2);
    const starRing = new THREE.Mesh(starRingGeo, chromeMat);
    starRing.position.set(2.32, 2.05, 0);
    cabGroup.add(starRing);

    [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].forEach((angle) => {
      const spokeGeo = new THREE.CylinderGeometry(0.02, 0.008, 0.3, 8);
      spokeGeo.rotateX(angle);
      const spoke = new THREE.Mesh(spokeGeo, chromeMat);
      spoke.position.set(2.32, 2.05 + 0.13 * Math.cos(angle), 0.13 * Math.sin(angle));
      cabGroup.add(spoke);
    });

    // Windshield (slanted glass)
    const windshieldGeo = new THREE.BoxGeometry(0.2, 1.5, 3.0);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(1.9, 3.7, 0);
    windshield.rotation.z = -0.15;
    cabGroup.add(windshield);

    // Aerodynamic Sun Visor Shield across top of windshield
    const visorGeo = new THREE.BoxGeometry(0.35, 0.25, 3.2);
    const visor = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.3 }));
    visor.position.set(2.05, 4.4, 0);
    cabGroup.add(visor);

    // Side Windows
    const sideWinGeo = new THREE.BoxGeometry(1.6, 1.0, 0.2);
    const sideWinL = new THREE.Mesh(sideWinGeo, glassMat);
    sideWinL.position.set(0.6, 3.7, 1.7);
    cabGroup.add(sideWinL);
    const sideWinR = new THREE.Mesh(sideWinGeo, glassMat);
    sideWinR.position.set(0.6, 3.7, -1.7);
    cabGroup.add(sideWinR);

    // Front Bumper with Headlights
    const bumperGeo = new THREE.BoxGeometry(0.6, 0.9, 3.5);
    const bumper = new THREE.Mesh(bumperGeo, isFlatbedRef ? cabPaintMat : cabAccentMat);
    bumper.position.set(2.1, 0.5, 0);
    cabGroup.add(bumper);

    // Actros Angular Headlights with LED DRL
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.7), lightMat);
    lightL.position.set(2.42, 0.5, 1.1);
    cabGroup.add(lightL);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.7), lightMat);
    lightR.position.set(2.42, 0.5, -1.1);
    cabGroup.add(lightR);

    // Front License Plate
    const plateGeo = new THREE.BoxGeometry(0.08, 0.25, 0.9);
    const plateMesh = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0x223344 }));
    plateMesh.position.set(2.42, 0.35, 0);
    cabGroup.add(plateMesh);

    // Side Mirrors with Aerodynamic Stalks
    const mirrorGeo = new THREE.BoxGeometry(0.25, 0.8, 0.3);
    const mirrorL = new THREE.Mesh(mirrorGeo, cabPaintMat);
    mirrorL.position.set(1.6, 3.8, 2.0);
    cabGroup.add(mirrorL);
    const mirrorR = new THREE.Mesh(mirrorGeo, cabPaintMat);
    mirrorR.position.set(1.6, 3.8, -2.0);
    cabGroup.add(mirrorR);

    truck.add(cabGroup);

    // 4. Trailer Body: Specific to the 4 Canonical Types
    const trailerGroup = new THREE.Group();
    trailerGroup.position.set(-3.2, 1.8, 0);

    if (typeId === "flatbed") {
      // ════════════════════════════════════════════════════════════════
      // 1. FLATBED (سطحة) — Exact replica of official reference photo:
      // Super-long extruded aluminum platform + front bulkhead +
      // dual horizontal side underrun guardrails + triple axles
      // ════════════════════════════════════════════════════════════════
      const bedDeckMat = new THREE.MeshStandardMaterial({
        color: 0xc8d1dd, // Clean Silver Metallic Deck Platform
        roughness: 0.45,
        metalness: 0.7,
      });

      // Extra-long Flatbed Platform Deck
      const bedDeck = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.35, 3.4), bedDeckMat);
      bedDeck.position.set(-0.5, 0.65, 0);
      trailerGroup.add(bedDeck);

      // Front Bulkhead (Headache Rack / واقي الكابينة) matching silver photo
      const headRack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 3.35), bedDeckMat);
      headRack.position.set(7.6, 2.05, 0);
      trailerGroup.add(headRack);

      // Stiffeners on Bulkhead
      [-1.0, 0, 1.0].forEach((bz) => {
        const stiffener = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.08), chromeMat);
        stiffener.position.set(7.76, 2.05, bz);
        trailerGroup.add(stiffener);
      });

      // Double Horizontal Silver Side Underrun Guardrails (حواجز الحماية المزدوجة كما في الصورة)
      [-1.68, 1.68].forEach((gz) => {
        // Upper rail
        const railUp = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.12, 0.06), chromeMat);
        railUp.position.set(1.5, 0.9, gz);
        trailerGroup.add(railUp);

        // Lower rail
        const railDown = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.12, 0.06), chromeMat);
        railDown.position.set(1.5, 0.5, gz);
        trailerGroup.add(railDown);

        // Vertical support posts
        [-2.2, 0.2, 2.6, 5.0].forEach((vx) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.06), chassisMat);
          post.position.set(vx, 0.7, gz);
          trailerGroup.add(post);
        });
      });

      // Trailer Landing Gear Legs (أرجل هبوط المقطورة)
      [-1.4, 1.4].forEach((lz) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), chassisMat);
        leg.position.set(4.8, 0.0, lz);
        trailerGroup.add(leg);
      });

      // Rear Bumper with Tail-lights
      const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 3.4), chassisMat);
      rearBumper.position.set(-8.8, 0.4, 0);
      trailerGroup.add(rearBumper);

      [-1.2, -0.6, 0.6, 1.2].forEach((lz) => {
        const rLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.35), redLightMat);
        rLight.position.set(-8.93, 0.4, lz);
        trailerGroup.add(rLight);
      });
    } else if (typeId === "reefer") {
      // ════════════════════════════════════════════════════════════════
      // 2. REFRIGERATED (براد) — White thermal box + ThermoKing cooling unit
      // ════════════════════════════════════════════════════════════════
      const reeferMat = new THREE.MeshStandardMaterial({
        color: 0xf5f8fc,
        roughness: 0.35,
        metalness: 0.15,
      });
      const reeferTrimMat = new THREE.MeshStandardMaterial({
        color: 0x0a1931,
        roughness: 0.5,
        metalness: 0.6,
      });

      // Main Insulated Box
      const boxGeo = new THREE.BoxGeometry(15.2, 4.2, 3.4);
      const reeferBox = new THREE.Mesh(boxGeo, reeferMat);
      reeferBox.position.set(0, 2.4, 0);
      trailerGroup.add(reeferBox);

      // Blue Cold-Chain Brand Decal Stripe
      const stripeGeo = new THREE.BoxGeometry(15.22, 0.6, 3.42);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x2f80ff });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0, 2.4, 0);
      trailerGroup.add(stripe);

      // Rooftop / Front Cooling Condenser Unit (ThermoKing / Carrier)
      const coolerGeo = new THREE.BoxGeometry(1.2, 2.0, 2.4);
      const cooler = new THREE.Mesh(coolerGeo, reeferTrimMat);
      cooler.position.set(7.8, 3.2, 0);
      trailerGroup.add(cooler);

      // Cooling Fan Grille
      const fanGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16);
      fanGeo.rotateZ(Math.PI / 2);
      const fan = new THREE.Mesh(fanGeo, chromeMat);
      fan.position.set(8.45, 3.3, 0);
      trailerGroup.add(fan);

      // Digital Temp LED Panel (displaying -18.5°C in cyan glow)
      const ledGeo = new THREE.BoxGeometry(0.05, 0.35, 0.7);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(8.43, 2.4, 0);
      trailerGroup.add(led);

      // Rear Insulated Double Doors & Stainless Lock Rods
      const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.0, 8);
      const rod1 = new THREE.Mesh(rodGeo, chromeMat);
      rod1.position.set(-7.65, 2.4, 0.6);
      trailerGroup.add(rod1);
      const rod2 = new THREE.Mesh(rodGeo, chromeMat);
      rod2.position.set(-7.65, 2.4, -0.6);
      trailerGroup.add(rod2);
    } else if (typeId === "dry") {
      // ════════════════════════════════════════════════════════════════
      // 3. DRY (جاف) — Solid composite corrugated box with security locks
      // ════════════════════════════════════════════════════════════════
      const dryBoxMat = new THREE.MeshStandardMaterial({
        color: 0x1a2638,
        roughness: 0.5,
        metalness: 0.5,
      });

      // Main Dry Box
      const dryGeo = new THREE.BoxGeometry(15.2, 4.2, 3.4);
      const dryBox = new THREE.Mesh(dryGeo, dryBoxMat);
      dryBox.position.set(0, 2.4, 0);
      trailerGroup.add(dryBox);

      // Top & Bottom Aluminum Reinforcement Rails
      const railTopGeo = new THREE.BoxGeometry(15.3, 0.25, 3.5);
      const railTop = new THREE.Mesh(railTopGeo, chromeMat);
      railTop.position.set(0, 4.5, 0);
      trailerGroup.add(railTop);

      const railBotGeo = new THREE.BoxGeometry(15.3, 0.25, 3.5);
      const railBot = new THREE.Mesh(railBotGeo, chromeMat);
      railBot.position.set(0, 0.4, 0);
      trailerGroup.add(railBot);

      // Vertical Stiffeners (Ribs along side)
      for (let i = -6; i <= 6; i += 1.5) {
        const ribGeo = new THREE.BoxGeometry(0.08, 4.0, 3.46);
        const rib = new THREE.Mesh(ribGeo, chassisMat);
        rib.position.set(i, 2.4, 0);
        trailerGroup.add(rib);
      }

      // Heavy Rear Latches & Customs Security Seal
      const sealMat = new THREE.MeshBasicMaterial({ color: 0x2fd08a });
      const seal = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), sealMat);
      seal.position.set(-7.65, 2.2, 0);
      trailerGroup.add(seal);
    } else {
      // ════════════════════════════════════════════════════════════════
      // 4. CURTAINSIDER (ستارة) — High-tensile canvas curtain with straps
      // ════════════════════════════════════════════════════════════════
      const curtainMat = new THREE.MeshStandardMaterial({
        color: 0x0d1e34,
        roughness: 0.65,
        metalness: 0.2,
      });
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xd8e0ed,
        roughness: 0.7,
        metalness: 0.1,
      });

      // Curtain Main Body
      const curtainGeo = new THREE.BoxGeometry(15.2, 4.0, 3.4);
      const curtain = new THREE.Mesh(curtainGeo, curtainMat);
      curtain.position.set(0, 2.4, 0);
      trailerGroup.add(curtain);

      // Roof Tarp
      const roofGeo = new THREE.BoxGeometry(15.3, 0.2, 3.5);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, 4.45, 0);
      trailerGroup.add(roof);

      // EJAZ Signature Orange Brand Side Band
      const bandGeo = new THREE.BoxGeometry(15.22, 0.9, 3.42);
      const bandMat = new THREE.MeshStandardMaterial({
        color: 0xff7a00,
        roughness: 0.3,
        metalness: 0.3,
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(0, 2.4, 0);
      trailerGroup.add(band);

      // Horizontal Tensioner Straps & Buckles
      const buckleMat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.2,
        metalness: 0.9,
      });
      for (let i = -6.5; i <= 6.5; i += 1.3) {
        const strapGeo = new THREE.BoxGeometry(0.06, 3.8, 3.44);
        const strap = new THREE.Mesh(strapGeo, cabAccentMat);
        strap.position.set(i, 2.4, 0);
        trailerGroup.add(strap);

        // Buckle on both sides
        const buckleL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.1), buckleMat);
        buckleL.position.set(i, 1.2, 1.72);
        trailerGroup.add(buckleL);
        const buckleR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.1), buckleMat);
        buckleR.position.set(i, 1.2, -1.72);
        trailerGroup.add(buckleR);
      }
    }

    // Rear Taillights for all trailers
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.8), redLightMat);
    tailL.position.set(-7.7, 1.2, 1.2);
    trailerGroup.add(tailL);
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.8), redLightMat);
    tailR.position.set(-7.7, 1.2, -1.2);
    trailerGroup.add(tailR);

    // Rear Underrun Protection Bar (Bumper)
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 3.4), chromeMat);
    rearBumper.position.set(-7.7, 0.8, 0);
    trailerGroup.add(rearBumper);

    truck.add(trailerGroup);

    return truck;
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setGlSupported(false);
        return;
      }
    } catch {
      setGlSupported(false);
      return;
    }

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera: 3/4 Front View (Cab, Body, Wheels in full glory)
    const aspect = container.clientWidth / (container.clientHeight || 300);
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.5, 100);
    cameraRef.current = camera;
    resetCamera();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    // 4. Lighting: Three-Point Studio Lighting
    // Warm Key Light
    const keyLight = new THREE.DirectionalLight(0xfff4e5, 2.2);
    keyLight.position.set(16, 20, 16);
    scene.add(keyLight);

    // Cool Soft Fill Light
    const fillLight = new THREE.DirectionalLight(0xb4d3fe, 1.1);
    fillLight.position.set(-16, 12, -12);
    scene.add(fillLight);

    // Sharp Rim / Kick Light from behind
    const rimLight = new THREE.DirectionalLight(0xffaa44, 1.8);
    rimLight.position.set(-20, 16, 12);
    scene.add(rimLight);

    // Soft Ambient Light
    const ambientLight = new THREE.AmbientLight(0x182436, 1.6);
    scene.add(ambientLight);

    // 5. Studio Stage / Ground Disc with Contact Shadow
    const stageGeo = new THREE.CircleGeometry(16, 48);
    stageGeo.rotateX(-Math.PI / 2);
    const stageMat = new THREE.MeshBasicMaterial({
      color: 0x050c1a,
      transparent: true,
      opacity: 0.7,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = 0;
    scene.add(stage);

    // Concentric Ring Markings
    const ringGeo = new THREE.RingGeometry(15.8, 16.0, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x294160,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(ring);

    // Initial Truck Assembly
    const initialTruck = buildTruckModel(activeType);
    truckGroupRef.current = initialTruck;
    scene.add(initialTruck);

    // Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Auto rotation when not interacting
      if (autoRotate && !isPointerDownRef.current) {
        sphericalRef.current.theta += delta * 0.35;
      }

      // Update camera position from spherical coords
      const { radius, theta, phi } = sphericalRef.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(targetLookAtRef.current);

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        if (width > 0 && h > 0) {
          camera.aspect = width / h;
          camera.updateProjectionMatrix();
          renderer.setSize(width, h);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [buildTruckModel, resetCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartRadiusRef = useRef<number>(24);
  const lastTapRef = useRef<number>(0);

  // Swap Truck Model when activeType changes with smooth model loading / procedural fallback
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!gltfLoaderRef.current) {
      gltfLoaderRef.current = new GLTFLoader();
    }

    let isCancelled = false;
    const meta = getVehicleTypeMeta(activeType);

    // Attempt loading external GLB if present, else mount high-fidelity procedural replica
    const loadModel = async () => {
      let loadedExternal = false;
      if (meta.glbPath) {
        try {
          const check = await fetch(meta.glbPath, { method: "HEAD" });
          if (check.ok && !isCancelled) {
            gltfLoaderRef.current?.load(
              meta.glbPath,
              (gltf) => {
                if (isCancelled || !sceneRef.current) return;
                if (truckGroupRef.current) {
                  sceneRef.current.remove(truckGroupRef.current);
                }
                const model = gltf.scene;
                // Auto-center and normalize model scale
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0) {
                  const scale = 20 / maxDim;
                  model.scale.setScalar(scale);
                }
                model.position.set(0, 1.4, 0);
                truckGroupRef.current = model;
                sceneRef.current.add(model);
              },
              undefined,
              () => {
                // Fallback to procedural
                if (!isCancelled && sceneRef.current) {
                  if (truckGroupRef.current) sceneRef.current.remove(truckGroupRef.current);
                  const procedural = buildTruckModel(activeType);
                  truckGroupRef.current = procedural;
                  sceneRef.current.add(procedural);
                }
              }
            );
            loadedExternal = true;
          }
        } catch {
          loadedExternal = false;
        }
      }

      if (!loadedExternal && !isCancelled && sceneRef.current) {
        if (truckGroupRef.current) {
          sceneRef.current.remove(truckGroupRef.current);
        }
        const newTruck = buildTruckModel(activeType);
        truckGroupRef.current = newTruck;
        sceneRef.current.add(newTruck);
      }
    };

    loadModel();

    return () => {
      isCancelled = true;
    };
  }, [activeType, buildTruckModel]);

  // Pointer Interaction Handlers (Mouse & Touch Orbiting)
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const dx = e.clientX - pointerPosRef.current.x;
    const dy = e.clientY - pointerPosRef.current.y;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };

    // Update spherical coordinates
    sphericalRef.current.theta -= dx * 0.008;
    sphericalRef.current.phi = Math.max(
      0.3,
      Math.min(Math.PI / 2 - 0.08, sphericalRef.current.phi - dy * 0.008)
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDownRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    sphericalRef.current.radius = Math.max(
      14,
      Math.min(36, sphericalRef.current.radius + e.deltaY * 0.02)
    );
  };

  // Touch handlers for mobile Pinch-to-Zoom and Double-tap Reset
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartRadiusRef.current = sphericalRef.current.radius;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        resetCamera();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = touchStartDistRef.current / (dist || 1);
      const targetRadius = touchStartRadiusRef.current * factor;
      sphericalRef.current.radius = Math.max(12, Math.min(38, targetRadius));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
  };

  const meta = getVehicleTypeMeta(activeType);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden select-none bg-radial from-surface-2 to-surface-0 flex flex-col justify-between",
        className
      )}
      style={{ height }}
    >
      {/* 3D WebGL Canvas */}
      {glSupported ? (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onDoubleClick={resetCamera}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing touch-none z-0"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted p-6 text-center z-0">
          <IconTruck size={42} className="text-brand mb-2" />
          <div className="font-semibold text-text-primary text-[14px]">
            {t("3D WebGL Viewport", "معرض النماذج ثلاثية الأبعاد")}
          </div>
          <div className="text-[12px] mt-1 text-text-secondary">
            {meta.arabicName} · {meta.englishName}
          </div>
        </div>
      )}

      {/* Floating HUD: Top Banner */}
      <div className="relative z-10 p-3 lg:p-4 flex items-start justify-between pointer-events-none">
        {/* Left: Active Vehicle Specs */}
        <div className="pointer-events-auto bg-surface-1/90 backdrop-blur-md rounded-[10px] p-2.5 border border-border-subtle shadow-lg max-w-[260px]">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta.accentColor }}
            />
            <span className="font-bold text-[13px] text-text-primary">
              {meta.arabicName} — {meta.englishName}
            </span>
          </div>

          <div className="text-[11px] text-text-secondary mt-1 line-clamp-2">
            {t(meta.descriptionEn, meta.descriptionAr)}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10.5px] border-t border-white/5 pt-1.5 tabular-nums text-text-muted">
            <span>{t("Max Payload", "الحمولة القصوى")}:</span>
            <span className="font-semibold text-brand">{meta.maxPayloadTons} {t("tons", "طن")}</span>
          </div>

          {vehicleModel && (
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-text-muted">
              <span>{t("Model", "الموديل")}:</span>
              <span className="font-medium text-text-primary">{vehicleModel}</span>
            </div>
          )}

          {vehiclePlate && (
            <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-text-muted">
              <span>{t("Plate", "اللوحة")}:</span>
              <span className="font-mono text-text-primary">{vehiclePlate}</span>
            </div>
          )}
        </div>

        {/* Right: Interactive 3D Control Actions */}
        {showControls && (
          <div className="pointer-events-auto flex flex-col gap-1.5 bg-surface-1/90 backdrop-blur-md p-1.5 rounded-[10px] border border-border-subtle shadow-lg">
            <button
              onClick={resetCamera}
              className="p-1.5 rounded-[6px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
              title={t("Reset Camera View (3/4 Front)", "إعادة ضبط الكاميرا")}
              aria-label="Reset View"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              onClick={zoomIn}
              className="p-1.5 rounded-[6px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
              title={t("Zoom In", "تكبير")}
              aria-label="Zoom In"
            >
              <IconZoomIn size={15} />
            </button>
            <button
              onClick={zoomOut}
              className="p-1.5 rounded-[6px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
              title={t("Zoom Out", "تصغير")}
              aria-label="Zoom Out"
            >
              <IconZoomOut size={15} />
            </button>
            <button
              onClick={() => setAutoRotate((r) => !r)}
              className={cn(
                "p-1.5 rounded-[6px] transition-colors text-[10px] font-bold",
                autoRotate
                  ? "bg-brand/20 text-brand"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-3"
              )}
              title={t("Toggle 360° Auto-Rotation", "تشغيل / إيقاف الدوران التلقائي")}
            >
              360°
            </button>
          </div>
        )}
      </div>

      {/* Floating HUD: Bottom Vehicle Carousel */}
      <div className="relative z-10 p-3 lg:p-4 pointer-events-auto flex flex-col items-center">
        {previewMode ? (
          /* Preview Mode: Full 4-Vehicle Switcher with Dots */
          <div className="w-full max-w-[460px] bg-surface-1/95 backdrop-blur-md rounded-[12px] p-2 border border-border-subtle shadow-2xl">
            <div className="flex items-center justify-between gap-1">
              {APPROVED_VEHICLE_TYPES_LIST.map((vt) => {
                const isSelected = activeType === vt.id;
                return (
                  <button
                    key={vt.id}
                    onClick={() => handleSelectType(vt.id)}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-[8px] text-[12px] font-medium transition-all duration-200 flex flex-col items-center gap-1",
                      isSelected
                        ? "bg-brand text-navy font-bold shadow-md"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                    )}
                  >
                    <span>{vt.arabicName}</span>
                    {/* Carousel Dot */}
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-all",
                        isSelected ? "bg-navy w-3" : "bg-text-muted/40"
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 text-center text-[10px] text-text-muted">
              {t("360° Interactive 3D Model · Drag to Rotate", "مجسم ثلاثي الأبعاد تفاعلي 360° · اسحب للدوران")}
            </div>
          </div>
        ) : (
          /* Real Vehicle Mode: Fixed Real Vehicle Indicator */
          <div className="flex items-center gap-2 bg-surface-1/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border-subtle text-[11.5px] text-text-secondary shadow-lg">
            <span className="h-2 w-2 rounded-full bg-status-active animate-pulse" />
            <span className="font-semibold text-text-primary">
              {t("Real Fleet Unit", "مركبة أسطول مسجلة")}:
            </span>
            <span className="font-bold text-brand">{meta.arabicName}</span>
            <span className="text-text-muted">·</span>
            <span className="text-[11px] font-mono">{vehiclePlate || "EJAZ FLEET"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
