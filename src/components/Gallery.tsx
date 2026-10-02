import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { IconArrowLeft, IconArrowRight, IconClose, IconUpload } from "./Icons";

export interface GalleryItem {
  src: string;
  en: string;
  ar: string;
}

function SafeImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-surface-5 text-[10.5px] text-text-muted",
          className,
        )}
      >
        <span className="px-2 text-center">No preview</span>
      </div>
    );
  }
  return (
    <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
  );
}

export function Gallery({ items }: { items: GalleryItem[] }) {
  const { t, dir } = useSettings();
  const [list, setList] = useState<GalleryItem[]>(items);
  const [idx, setIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setList(items), [items]);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      if (e.key === "ArrowRight") setIdx((i) => ((i ?? 0) + 1) % list.length);
      if (e.key === "ArrowLeft") setIdx((i) => ((i ?? 0) - 1 + list.length) % list.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, list.length]);

  const addFromDevice = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setList((l) => [...l, { src: url, en: file.name.slice(0, 28), ar: file.name.slice(0, 28) }]);
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] tracking-wide text-text-muted uppercase">
          {t("Cargo Photo Reports", "تقارير الصور المرفقة")}
        </span>
        <span className="badge bg-surface-5 text-text-secondary">{list.length}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {list.map((p, i) => (
          <button
            key={`${p.src}-${i}`}
            onClick={() => setIdx(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-[8px] bg-surface-2"
          >
            <SafeImg
              src={p.src}
              alt={p.ar}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
            <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 text-start text-[10.5px] leading-tight text-white">
              {t(p.en, p.ar)}
            </span>
          </button>
        ))}

        <button
          onClick={() => fileRef.current?.click()}
          className="group grid aspect-[4/3] place-items-center rounded-[8px] border border-dashed border-border-subtle bg-surface-2 text-text-muted transition-all duration-200 hover:border-brand hover:text-brand active:scale-95"
        >
          <span className="grid place-items-center gap-1.5">
            <IconUpload size={18} />
            <span className="text-[10.5px]">{t("Add photo", "إضافة صورة")}</span>
          </span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => addFromDevice(e.target.files?.[0])}
      />

      {idx !== null && (
        <div
          className="animate-fade-in fixed inset-0 z-[80] grid place-items-center bg-black/92 p-6 backdrop-blur-xl"
          onClick={() => setIdx(null)}
        >
          <div
            className="relative w-full max-w-[820px]"
            onClick={(e) => e.stopPropagation()}
          >
            <SafeImg
              src={list[idx].src}
              alt={list[idx].ar}
              className="max-h-[70vh] w-full rounded-[8px] object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[15px] font-medium text-white">
                  {t(list[idx].en, list[idx].ar)}
                </div>
                <div className="text-[11px] tabular-nums text-white/55">
                  {idx + 1} / {list.length}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIdx((i) => ((i ?? 0) - 1 + list.length) % list.length)}
                  className="btn-icon bg-white/10 text-white"
                  aria-label="Previous"
                >
                  {dir === "rtl" ? <IconArrowRight size={16} /> : <IconArrowLeft size={16} />}
                </button>
                <button
                  onClick={() => setIdx((i) => ((i ?? 0) + 1) % list.length)}
                  className="btn-icon bg-white/10 text-white"
                  aria-label="Next"
                >
                  {dir === "rtl" ? <IconArrowLeft size={16} /> : <IconArrowRight size={16} />}
                </button>
                <button
                  onClick={() => setIdx(null)}
                  className="btn-icon bg-white/10 text-white"
                  aria-label="Close"
                >
                  <IconClose size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
