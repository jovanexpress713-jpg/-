import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { getCanonicalVehicleModel } from "../data/canonicalVehicleModels";
import { normalizeVehicleType, type CanonicalVehicleTypeId } from "../data/vehicleTypes";
import { TruckImage } from "./TruckImage";

const MAX_LIVE_CONTEXTS = 6;
let liveContexts = 0;

function claimContext() {
  if (liveContexts >= MAX_LIVE_CONTEXTS) return false;
  liveContexts += 1;
  return true;
}

function releaseContext() {
  liveContexts = Math.max(0, liveContexts - 1);
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function materialFor(type: CanonicalVehicleTypeId) {
  const colors: Record<CanonicalVehicleTypeId, number> = {
    curtain: 0xff8a00,
    dry: 0xe7ebf0,
    reefer: 0xd9e1e8,
    flatbed: 0x9aa5b1,
  };
  return new THREE.MeshStandardMaterial({
    color: colors[type],
    roughness: 0.28,
    metalness: 0.42,
  });
}

export interface CanonicalVehicle3DViewerProps {
  vehicleType?: string;
  vehiclePlate?: string;
  className?: string;
  height?: string | number;
  autoRotate?: boolean;
  compact?: boolean;
}

export function CanonicalVehicle3DViewer({
  vehicleType = "curtain",
  vehiclePlate,
  className = "",
  height = "100%",
  autoRotate = true,
  compact = false,
}: CanonicalVehicle3DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(compact ? 1.18 : 1);
  const type = normalizeVehicleType(vehicleType);
  const descriptor = getCanonicalVehicleModel(type);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    if (!claimContext()) {
      setFailed(true);
      return;
    }

    let disposed = false;
    let frame = 0;
    let root: THREE.Object3D | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d15);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    camera.position.set(8.5, 4.8, 10.5);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;

    scene.add(new THREE.HemisphereLight(0xf6f7fb, 0x18202d, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(7, 12, 8);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8a00, 1.6);
    rim.position.set(-8, 5, -7);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(12, 64),
      new THREE.MeshStandardMaterial({ color: 0x111725, roughness: 0.9, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const loader = new OBJLoader();
    loader.load(
      descriptor.url,
      (object) => {
        if (disposed) {
          disposeObject(object);
          return;
        }
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z, 0.001);
        const target = compact ? 7.5 : 8.5;
        const normalizedScale = (target / largest) * descriptor.scale;
        object.position.sub(center);
        object.scale.setScalar(normalizedScale);
        object.position.y = descriptor.yOffset;
        object.rotation.y = descriptor.rotationY;
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = materialFor(type);
        });
        root = object;
        scene.add(object);
        setReady(true);
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      },
    );

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const heightPx = Math.max(1, container.clientHeight);
      renderer.setSize(width, heightPx, false);
      camera.aspect = width / heightPx;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const onPointerDown = (event: PointerEvent) => {
      (canvas as HTMLCanvasElement & { __ejazPointer?: { x: number; y: number } }).__ejazPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const state = (canvas as HTMLCanvasElement & { __ejazPointer?: { x: number; y: number } }).__ejazPointer;
      if (!state || !root) return;
      const dx = event.clientX - state.x;
      state.x = event.clientX;
      state.y = event.clientY;
      root.rotation.y += dx * 0.012;
      setAngle((((root.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI);
    };
    const onPointerUp = () => {
      delete (canvas as HTMLCanvasElement & { __ejazPointer?: { x: number; y: number } }).__ejazPointer;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((value) => THREE.MathUtils.clamp(value * (event.deltaY > 0 ? 0.92 : 1.08), 0.65, 1.55));
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (root && autoRotate) {
        root.rotation.y += 0.0035;
        setAngle((((root.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI);
      }
      const targetDistance = (compact ? 13 : 15) / zoom;
      const direction = camera.position.clone().normalize();
      camera.position.lerp(direction.multiplyScalar(targetDistance), 0.06);
      camera.lookAt(0, 1.2, 0);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      if (root) disposeObject(root);
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      releaseContext();
    };
  }, [descriptor.url, descriptor.scale, descriptor.rotationY, descriptor.yOffset, type, compact, autoRotate, zoom]);

  if (failed) {
    return (
      <div className={`relative overflow-hidden rounded-[inherit] bg-surface-2 ${className}`} style={{ height }}>
        <TruckImage body={type} alt={vehiclePlate ? `EJAZ ${vehiclePlate}` : "EJAZ Transport"} className="h-full w-full object-contain p-8" loading="eager" />
        <div className="absolute bottom-3 start-3 rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1.5 text-micro font-semibold text-text-secondary backdrop-blur">
          نموذج EJAZ القياسي غير متاح — صورة مرجعية
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-[inherit] bg-[#090d15] ${className}`} style={{ height }}>
      <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="EJAZ canonical 3D vehicle viewer" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="rounded-full border border-brand/30 bg-surface-1/80 px-3 py-1.5 text-micro font-bold text-brand backdrop-blur">EJAZ · CANONICAL 3D</div>
        <div className="rounded-full border border-border-subtle bg-surface-1/80 px-3 py-1.5 text-micro font-semibold text-text-secondary backdrop-blur">{Math.round(angle)}°</div>
      </div>
      <div className="pointer-events-none absolute bottom-3 start-3 rounded-panel border border-border-subtle bg-surface-1/85 px-3 py-2 text-micro text-text-secondary backdrop-blur">
        {descriptor.labelAr} · اسحب للدوران · مرر للتقريب
      </div>
      {!ready && <div className="absolute inset-0 grid place-items-center bg-surface-1/50 backdrop-blur-sm"><div className="rounded-full border border-brand/30 bg-surface-1 px-4 py-2 text-label font-semibold text-brand">جارٍ تحميل النموذج…</div></div>}
    </div>
  );
}
