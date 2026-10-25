import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Real coupled curtainsider rig assembled from two published CC0 GLBs from the
 * same Long-Haul Trucking pack. No procedural truck geometry is used here.
 */
export const CURTAIN_RIG_ASSETS = {
  tractor: "https://cdn.3dassets.dev/assets/13946/v1/model.glb",
  trailer: "https://cdn.3dassets.dev/assets/13957/v1/model.glb",
} as const;

export function CurtainRig3DViewer({ height = 320 }: { height?: number | string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    camera.position.set(16, 8.5, 18);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.HemisphereLight(0xdcecff, 0x07111e, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(12, 18, 16);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9b4a, 1.5);
    rim.position.set(-18, 10, -16);
    scene.add(rim);

    const stage = new THREE.Mesh(
      new THREE.CircleGeometry(22, 64),
      new THREE.MeshStandardMaterial({ color: 0x07111e, roughness: 0.9, metalness: 0.05 })
    );
    stage.rotation.x = -Math.PI / 2;
    stage.receiveShadow = true;
    scene.add(stage);

    const rig = new THREE.Group();
    scene.add(rig);

    const loader = new GLTFLoader();
    let cancelled = false;
    let tractor: THREE.Object3D | null = null;
    let trailer: THREE.Object3D | null = null;
    const mixers: THREE.AnimationMixer[] = [];

    const prepare = (root: THREE.Object3D) => {
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const material = mesh.material as THREE.MeshStandardMaterial;
          if (material && "envMapIntensity" in material) material.envMapIntensity = 1.2;
        }
      });
    };

    const placeRig = () => {
      if (!tractor || !trailer || cancelled) return;
      rig.clear();
      prepare(tractor);
      prepare(trailer);

      // Both assets use metres, +Y up, and the same pack scale. The trailer's
      // front is +Z, so its front edge sits directly behind the tractor's rear.
      const tractorBox = new THREE.Box3().setFromObject(tractor);
      const trailerBox = new THREE.Box3().setFromObject(trailer);
      const tractorCenter = tractorBox.getCenter(new THREE.Vector3());
      const trailerCenter = trailerBox.getCenter(new THREE.Vector3());
      const tractorDepth = tractorBox.getSize(new THREE.Vector3()).z;
      const trailerDepth = trailerBox.getSize(new THREE.Vector3()).z;

      tractor.position.sub(tractorCenter);
      trailer.position.sub(trailerCenter);
      tractor.position.y += -tractorBox.min.y;
      trailer.position.y += -trailerBox.min.y;
      trailer.position.z = -(tractorDepth + trailerDepth) * 0.5 + 0.12;

      rig.add(tractor);
      rig.add(trailer);

      const combined = new THREE.Box3().setFromObject(rig);
      const size = combined.getSize(new THREE.Vector3());
      const center = combined.getCenter(new THREE.Vector3());
      rig.position.set(-center.x, -combined.min.y + 0.04, -center.z);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 24 / maxDim : 1;
      rig.scale.setScalar(scale);
      rig.rotation.y = Math.PI;

      const scaled = new THREE.Box3().setFromObject(rig);
      const target = scaled.getCenter(new THREE.Vector3());
      camera.lookAt(target.x, target.y * 0.9, target.z);
      camera.position.set(target.x + 14, target.y + 7, target.z + 18);
    };

    const load = (url: string, onDone: (root: THREE.Object3D, animations: THREE.AnimationClip[]) => void) => {
      loader.load(
        url,
        (gltf) => {
          if (cancelled) return;
          onDone(gltf.scene, gltf.animations);
        },
        undefined,
        () => {
          if (!cancelled) host.dataset.assetError = "true";
        },
      );
    };

    load(CURTAIN_RIG_ASSETS.tractor, (root, animations) => {
      tractor = root;
      if (animations.length) {
        const mixer = new THREE.AnimationMixer(root);
        mixers.push(mixer);
        const wheel = animations.find((clip) => /wheel-roll/i.test(clip.name));
        if (wheel) mixer.clipAction(wheel).play();
      }
      placeRig();
    });

    load(CURTAIN_RIG_ASSETS.trailer, (root, animations) => {
      trailer = root;
      if (animations.length) {
        const mixer = new THREE.AnimationMixer(root);
        mixers.push(mixer);
        const wheel = animations.find((clip) => /wheel-roll/i.test(clip.name));
        if (wheel) mixer.clipAction(wheel).play();
      }
      placeRig();
    });

    let theta = 0.55;
    let targetTheta = theta;
    let phi = 1.16;
    let targetPhi = phi;
    let radius = 30;
    let targetRadius = radius;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastTime = performance.now();
    let raf = 0;

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const heightPx = Math.max(host.clientHeight, 1);
      camera.aspect = width / heightPx;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, heightPx, false);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      targetTheta -= (event.clientX - lastX) * 0.008;
      targetPhi = THREE.MathUtils.clamp(targetPhi - (event.clientY - lastY) * 0.006, 0.72, 1.5);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => { dragging = false; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetRadius = THREE.MathUtils.clamp(targetRadius + event.deltaY * 0.025, 18, 48);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const animate = (time: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!dragging) targetTheta += dt * 0.18;
      theta += (targetTheta - theta) * 0.09;
      phi += (targetPhi - phi) * 0.09;
      radius += (targetRadius - radius) * 0.09;
      const target = new THREE.Vector3(0, 3.0, 0);
      camera.position.set(
        Math.cos(theta) * Math.sin(phi) * radius,
        Math.cos(phi) * radius,
        Math.sin(theta) * Math.sin(phi) * radius,
      );
      camera.lookAt(target);
      mixers.forEach((mixer) => mixer.update(dt));
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      mixers.forEach((mixer) => mixer.stopAllAction());
      rig.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
          else mesh.material?.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} className="relative w-full overflow-hidden bg-[#07111e]" style={{ height }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label="EJAZ curtainsider tractor and trailer 3D model" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-brand/40 bg-[#07111e]/80 px-3 py-1 text-[10px] font-bold text-brand backdrop-blur">
        3D GLB · جرار + مقطورة ستارة
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] text-white/70 backdrop-blur">
        اسحب للتدوير · العجلة للتقريب
      </div>
    </div>
  );
}

export default CurtainRig3DViewer;
