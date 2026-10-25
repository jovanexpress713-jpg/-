import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/** Procedural 3D concept truck: real Three.js geometry, no fake GLB URL or external model dependency. */
export function EJAZTruckStage({ variant = "curtain" }: { variant?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let targetY = -0.55;
    let targetX = -0.12;

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(7.4, 4.6, 8.5);
    camera.lookAt(0, 1.1, 0);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      setWebglUnavailable(false);
    } catch {
      setWebglUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-label", "مجسم شاحنة ثلاثي الأبعاد — اسحب لتدوير الشاحنة");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.cursor = "grab";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x111a29, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(5, 9, 6);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.PointLight(0xff7138, 34, 18);
    rim.position.set(-4, 3.4, -3);
    scene.add(rim);

    const truck = new THREE.Group();
    scene.add(truck);
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf4, metalness: 0.45, roughness: 0.32 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff7138, metalness: 0.35, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x172336, metalness: 0.25, roughness: 0.55 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x5c819c, metalness: 0.45, roughness: 0.18 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9eafc4, metalness: 0.85, roughness: 0.25 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x17253a, metalness: 0.15, roughness: 0.8 });

    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number,number,number], parent: THREE.Group = truck) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(...position);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const box = (size: [number,number,number], material: THREE.Material, pos: [number,number,number], parent?: THREE.Group) =>
      mesh(new THREE.BoxGeometry(...size), material, pos, parent);

    // Chassis, front cab, bumper, windshield and mirrors.
    box([5.0,0.22,1.15], dark, [-0.2,0.73,0]);
    box([1.38,1.45,1.3], orange, [1.7,1.43,0]);
    box([1.16,0.55,1.22], paint, [1.76,2.0,0]);
    box([0.08,0.43,0.96], glass, [2.35,1.98,0]);
    box([0.15,0.16,1.42], dark, [2.37,1.18,0]);
    box([0.22,0.32,0.14], paint, [1.82,1.25,0.72]);
    box([0.22,0.32,0.14], paint, [1.82,1.25,-0.72]);
    box([0.18,0.32,0.18], dark, [1.4,1.47,0.72]);
    box([0.18,0.32,0.18], dark, [1.4,1.47,-0.72]);

    // Trailer style adapts to the selected registered vehicle category.
    const isFlat = variant === "flatbed";
    const isReefer = variant === "reefer";
    const isDry = variant === "dry";
    if (isFlat) {
      box([3.0,0.16,1.28], orange, [-0.45,1.05,0]);
      for (let i=0;i<6;i++) box([0.09,0.5,0.08], paint, [-1.75+i*0.5,1.34,0.58]);
    } else {
      const trailerMat = isReefer ? paint : (isDry ? dark : new THREE.MeshStandardMaterial({color:0x344961,metalness:0.25,roughness:0.55}));
      box([3.05,1.65,1.35], trailerMat, [-0.48,1.65,0]);
      box([3.1,0.12,1.4], orange, [-0.48,0.82,0]);
      for (let i=0;i<7;i++) {
        box([0.025,1.38,0.018], isReefer ? dark : orange, [-1.88+i*0.43,1.65,0.685]);
      }
      if (isReefer) {
        box([0.22,0.55,0.8], dark, [-2.05,1.72,0]);
        box([0.08,0.28,0.42], paint, [-2.19,1.73,0]);
      }
      if (isDry) {
        for (let i=0;i<5;i++) box([0.035,1.45,0.02], paint, [-1.8+i*0.57,1.65,0.69]);
      }
    }

    // Six wheels with metallic hubs.
    const wheelPositions: [number,number,number][] = [[-1.65,0.52,0.72],[-0.95,0.52,0.72],[0.95,0.52,0.72],[2.0,0.52,0.72],[-1.65,0.52,-0.72],[-0.95,0.52,-0.72],[0.95,0.52,-0.72],[2.0,0.52,-0.72]];
    for (const p of wheelPositions) {
      const w = mesh(new THREE.CylinderGeometry(0.36,0.36,0.19,28), rubber, p);
      w.rotation.x = Math.PI/2;
      const hub = mesh(new THREE.CylinderGeometry(0.17,0.17,0.205,24), rimMat, p);
      hub.rotation.x = Math.PI/2;
      const center = mesh(new THREE.CylinderGeometry(0.065,0.065,0.21,16), dark, p);
      center.rotation.x = Math.PI/2;
    }
    box([0.08,0.08,0.2], paint, [2.48,1.35,0.48]);
    box([0.08,0.08,0.2], paint, [2.48,1.35,-0.48]);

    const ground = mesh(new THREE.CircleGeometry(5.5, 64), floorMat, [0,0.12,0]);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    const grid = new THREE.GridHelper(12, 24, 0x38506d, 0x1c2d43);
    grid.position.y = 0.13;
    scene.add(grid);

    const resize = () => {
      if (!host || disposed) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = "grabbing"; renderer.domElement.setPointerCapture?.(e.pointerId); };
    const onMove = (e: PointerEvent) => { if (!dragging) return; targetY += (e.clientX-lastX)*0.008; targetX = THREE.MathUtils.clamp(targetX+(e.clientY-lastY)*0.004,-0.35,0.22); lastX=e.clientX; lastY=e.clientY; };
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = "grab"; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (!dragging) targetY += 0.0017;
      truck.rotation.y += (targetY-truck.rotation.y)*0.055;
      truck.rotation.x += (targetX-truck.rotation.x)*0.055;
      renderer.render(scene,camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown",onDown);
      renderer.domElement.removeEventListener("pointermove",onMove);
      renderer.domElement.removeEventListener("pointerup",onUp);
      renderer.domElement.removeEventListener("pointercancel",onUp);
      scene.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach((m) => m.dispose()); } });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return (
    <div className="relative h-full min-h-[190px] w-full touch-pan-y" role="img" aria-label="مجسم شاحنة ثلاثي الأبعاد قابل للتدوير بالسحب">
      <div ref={hostRef} className="h-full min-h-[190px] w-full" />
      {webglUnavailable && (
        <div className="absolute inset-0 grid place-items-center rounded-xl border border-white/10 bg-slate-900/70 p-4 text-center text-sm text-slate-300">
          تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز. جرّب متصفحًا يدعم WebGL.
        </div>
      )}
    </div>
  );
}
