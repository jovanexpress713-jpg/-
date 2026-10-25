import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * A genuine third-party GLB asset (not generated geometry).
 * Grab3D publishes this model under CC0; it is a stylized reference model,
 * not a photoreal scan or a claim that it matches a customer's registered truck.
 */
const MODEL_URL = "https://grab3d.com/dl/semi-truck/semi-truck.glb";

export function TruckModel3DPreview() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let model: THREE.Object3D | null = null;
    const scene = new THREE.Scene();
    scene.background = null;

    const width = Math.max(host.clientWidth, 280);
    const height = Math.max(host.clientHeight, 260);
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000);
    camera.position.set(13, 8, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x303746, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(8, 12, 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8bbcff, 1.2);
    fill.position.set(-8, 5, -10);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 36;
    controls.target.set(0, 1.5, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;

    const resize = () => {
      if (!host || disposed) return;
      const w = Math.max(host.clientWidth, 280);
      const h = Math.max(host.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (disposed) {
          gltf.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.geometry.dispose();
              const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
              materials.forEach((material) => material.dispose());
            }
          });
          return;
        }
        model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(10 / largest);
        model.position.sub(center.multiplyScalar(10 / largest));
        scene.add(model);
        controls.target.set(0, Math.max(0.6, size.y * 0.22), 0);
        controls.update();
        setStatus("ready");
      },
      undefined,
      () => { if (!disposed) setStatus("error"); },
    );

    const animate = () => {
      if (disposed) return;
      frame = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (model) {
        scene.remove(model);
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach((material) => material.dispose());
          }
        });
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-1">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle p-4">
        <div>
          <div className="text-micro font-bold uppercase tracking-[0.14em] text-brand">GLB · CC0</div>
          <h3 className="mt-1 text-label-lg font-bold text-text-primary">نموذج شاحنة ومقطورة ثلاثي الأبعاد</h3>
          <p className="mt-1 max-w-xl text-micro leading-5 text-text-secondary">اسحب لتدوير الشاحنة، وقرّب أو أبعد بإصبعين. هذا نموذج مرجعي مستقل وليس بيانات مركبة عميل مسجلة.</p>
        </div>
        <a href="https://grab3d.com/models/vehicles/semi-truck/" target="_blank" rel="noreferrer" className="text-label font-semibold text-brand underline underline-offset-4">المصدر والترخيص</a>
      </div>
      <div className="relative h-[300px] sm:h-[370px]">
        <div ref={hostRef} className="absolute inset-0 touch-pan-y" aria-label="عارض نموذج شاحنة ثلاثي الأبعاد" />
        {status === "loading" && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-1/50"><span className="rounded-full border border-border-subtle bg-surface-1 px-4 py-2 text-label text-text-secondary">جارٍ تحميل النموذج ثلاثي الأبعاد…</span></div>}
        {status === "error" && <div className="absolute inset-0 grid place-items-center bg-surface-1 p-6 text-center"><div><p className="text-label font-semibold text-text-primary">تعذر تحميل النموذج من المكتبة الخارجية</p><p className="mt-2 text-micro text-text-secondary">تحقق من اتصال الإنترنت، أو افتح صفحة النموذج من المصدر.</p><a href="https://grab3d.com/models/vehicles/semi-truck/" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-label font-semibold text-brand underline underline-offset-4">فتح النموذج في المكتبة</a></div></div>}
      </div>
      <div className="border-t border-border-subtle px-4 py-3 text-micro text-text-muted">ملاحظة: النموذج من مكتبة مجانية بترخيص CC0، وهو مرجعي بأسلوب ثلاثي الأبعاد منمّق وليس تصويرًا فوتوغرافيًا أو نموذج مصنع مطابقًا.</div>
    </section>
  );
}
