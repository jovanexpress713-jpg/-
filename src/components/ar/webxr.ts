import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ARSessionLike, ARSessionOptions, ARSupportResult } from "./types";

interface XRNavigator { xr?: { isSessionSupported?: (mode: string) => Promise<boolean>; requestSession?: (mode: string, options?: Record<string, unknown>) => Promise<ARSessionLike>; }; }

export async function detectARSupport(): Promise<ARSupportResult> {
  if (typeof window === "undefined" || !window.isSecureContext) return { supported: false, reason: "يحتاج الواقع المعزز إلى اتصال HTTPS آمن." };
  const xr = (navigator as Navigator & XRNavigator).xr;
  if (!xr?.isSessionSupported) return { supported: false, reason: "هذا المتصفح لا يوفر WebXR للواقع المعزز." };
  try {
    const supported = await xr.isSessionSupported("immersive-ar");
    return supported ? { supported: true, reason: "الجهاز والمتصفح يدعمان الواقع المعزز." } : { supported: false, reason: "الجهاز أو المتصفح لا يدعم جلسة الواقع المعزز." };
  } catch { return { supported: false, reason: "تعذر التحقق من دعم الواقع المعزز." }; }
}

export async function startARSession(options: ARSessionOptions): Promise<ARSessionLike> {
  const xr = (navigator as Navigator & XRNavigator).xr;
  if (!xr?.requestSession) throw new Error("WebXR immersive-ar is unavailable");
  const session = await xr.requestSession("immersive-ar", { requiredFeatures: ["local-floor"], optionalFeatures: ["dom-overlay"] });
  const renderer = new THREE.WebGLRenderer({ canvas: options.canvas, alpha: true, antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4654, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 6, 4); scene.add(key);
  const gltf = await new GLTFLoader().loadAsync(options.modelUrl);
  const model = gltf.scene;
  model.scale.setScalar(options.scale || 1);
  model.rotation.y = THREE.MathUtils.degToRad(options.rotationY || 0);
  model.position.set(0, options.yOffset || 0, -2.5);
  scene.add(model);
  await renderer.xr.setSession(session as any);
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  session.addEventListener("end", () => { renderer.setAnimationLoop(null); renderer.dispose(); scene.clear(); });
  return session;
}
