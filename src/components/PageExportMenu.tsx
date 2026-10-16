import { useEffect, useRef, useState } from "react";
import { useSettings } from "../settings";

export interface PageExportProgress {
  completed: number;
  total: number;
}

interface PageExportMenuProps {
  surface: "page" | "screen";
  busy?: boolean;
  progress?: PageExportProgress | null;
  eligiblePageCount?: number;
  onExportCurrent: () => void;
  onPrint: () => void;
  onExportAll: () => void;
}

export function PageExportMenu({
  surface,
  busy = false,
  progress = null,
  eligiblePageCount = 0,
  onExportCurrent,
  onPrint,
  onExportAll,
}: PageExportMenuProps) {
  const { lang } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isArabic = lang === "ar";
  const label = surface === "screen"
    ? (isArabic ? "الشاشة" : "screen")
    : (isArabic ? "الصفحة" : "page");

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const copy = isArabic
    ? {
        title: "تصدير وطباعة",
        current: `حفظ ${label} كاملة كصورة JPG`,
        print: `طباعة ${label} كاملة / حفظها PDF`,
        all: `تصدير الصفحات المسموح بها (${eligiblePageCount})`,
        working: `جارٍ التصوير ${progress?.completed ?? 0} / ${progress?.total ?? 0}`,
        exportLabel: "تصدير",
        scope: "يقتصر التصدير الجماعي على الصفحات المتاحة لحسابك.",
      }
    : {
        title: "Export & print",
        current: `Save full current ${label} as JPG`,
        print: `Print full ${label} / save as PDF`,
        all: `Export permitted pages (${eligiblePageCount})`,
        working: `Capturing ${progress?.completed ?? 0} / ${progress?.total ?? 0}`,
        exportLabel: "Export",
        scope: "Bulk export includes only pages available to your account.",
      };

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative" ref={rootRef} data-export-exclude="true">
      <button
        type="button"
        aria-label={busy ? copy.working : copy.title}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-busy={busy}
        disabled={busy}
        title={busy ? copy.working : copy.title}
        onClick={() => setOpen((value) => !value)}
        className="btn-icon relative shrink-0 rounded-full border border-white/[0.08] bg-surface-2/70 text-text-secondary hover:bg-surface-3 hover:text-text-primary hover:border-brand/40 backdrop-blur-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-80"
      >
        {busy ? (
          <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
            <path d="M5 17v3h14v-3" />
          </svg>
        )}
      </button>

      {busy && progress && (
        <span className="absolute -bottom-1 -end-1 min-w-4 rounded-full bg-brand px-1 text-center text-micro font-bold leading-4 text-white">
          {progress.completed}/{progress.total}
        </span>
      )}

      {open && !busy && (
        <div
          role="menu"
          aria-label={copy.title}
          className="animate-fade-in absolute end-0 top-[calc(100%+10px)] z-[90] w-72 max-w-[calc(100vw-24px)] overflow-hidden rounded-panel border border-white/10 bg-[#0b1424] p-1.5 shadow-2xl shadow-black/50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onExportCurrent)}
            className="flex w-full items-center gap-3 rounded-inner px-3 py-2.5 text-start text-body font-semibold text-text-primary hover:bg-white/[0.07]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-inner bg-brand/10 text-brand">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
            </span>
            <span>{copy.current}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onPrint)}
            className="flex w-full items-center gap-3 rounded-inner px-3 py-2.5 text-start text-body font-semibold text-text-primary hover:bg-white/[0.07]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-inner bg-sky-400/10 text-sky-300">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2" />
                <path d="M7 14h10v7H7zM17 11h.01" />
              </svg>
            </span>
            <span>{copy.print}</span>
          </button>
          <div className="my-1.5 border-t border-white/[0.08]" />
          <button
            type="button"
            role="menuitem"
            disabled={eligiblePageCount === 0}
            onClick={() => run(onExportAll)}
            className="flex w-full items-center gap-3 rounded-inner px-3 py-2.5 text-start text-body font-semibold text-text-primary hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-inner bg-violet-400/10 text-violet-300">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 6h13M8 12h13M8 18h13" />
                <path d="M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">{copy.all}</span>
          </button>
          <p className="px-3 pb-2 pt-1 text-micro leading-relaxed text-text-muted">{copy.scope}</p>
        </div>
      )}
    </div>
  );
}
