import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../settings";
import { cn } from "../utils/cn";
import { capturePageJpeg, downloadJpeg, copyImageToClipboard, getExportRoot } from "../services/pageExport";

export interface PageExportProgress {
  completed: number;
  total: number;
}

interface PageExportMenuProps {
  surface: "page" | "screen";
  busy?: boolean;
  progress?: PageExportProgress | null;
  eligiblePageCount?: number;
  onExportCurrent: () => Promise<{ dataUrl?: string; filename?: string } | void> | void;
  onPrint: () => void;
  onExportAll: () => void;
  className?: string;
  buttonClassName?: string;
}

export function PageExportMenu({
  surface,
  busy = false,
  progress = null,
  eligiblePageCount = 0,
  onExportCurrent,
  onPrint,
  onExportAll,
  className,
  buttonClassName,
}: PageExportMenuProps) {
  const { lang } = useSettings();
  const [open, setOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [preview, setPreview] = useState<{ dataUrl: string; filename: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Position state: null initially until calculated on client
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem("ejaz_snapshot_pos");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const isArabic = lang === "ar";
  const label = surface === "screen"
    ? (isArabic ? "الشاشة" : "screen")
    : (isArabic ? "الصفحة" : "page");

  // Determine effective coordinates (clamped to viewport)
  const getEffectivePosition = () => {
    if (typeof window === "undefined") return { x: 20, y: 80 };
    const widgetWidth = isMinimized ? 52 : (isExpanded ? 460 : 272);
    const widgetHeight = isMinimized ? 52 : (isExpanded ? 360 : 156);

    if (position) {
      const clampedX = Math.max(8, Math.min(window.innerWidth - widgetWidth - 8, position.x));
      const clampedY = Math.max(8, Math.min(window.innerHeight - widgetHeight - 8, position.y));
      return { x: clampedX, y: clampedY };
    }

    // Default convenient position: bottom-start with safe margin
    const isRtl = document.documentElement.dir === "rtl" || isArabic;
    const defaultX = isRtl ? 20 : Math.max(16, window.innerWidth - widgetWidth - 20);
    const defaultY = Math.max(64, window.innerHeight - widgetHeight - 24);
    return { x: defaultX, y: defaultY };
  };

  const currentCoords = getEffectivePosition();

  // Close menu dropdown on outside pointer/escape
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

  // Window-level smooth dragging (never loses track even when moving rapidly)
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const widgetWidth = isMinimized ? 52 : (isExpanded ? 460 : 272);
      const widgetHeight = isMinimized ? 52 : (isExpanded ? 360 : 156);

      const targetX = dragStartRef.current.initialX + dx;
      const targetY = dragStartRef.current.initialY + dy;

      const clampedX = Math.max(8, Math.min(window.innerWidth - widgetWidth - 8, targetX));
      const clampedY = Math.max(8, Math.min(window.innerHeight - widgetHeight - 8, targetY));

      const next = { x: clampedX, y: clampedY };
      setPosition(next);
      try {
        sessionStorage.setItem("ejaz_snapshot_pos", JSON.stringify(next));
      } catch {}
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, isMinimized, isExpanded]);

  const copy = isArabic
    ? {
        title: `تصدير ولقطة ${label} بالكامل`,
        quickSave: `حفظ فوري ومباشر على سطح المكتب (JPG)`,
        quickSaveHint: "تنزيل فوري مع نافذة لقطة مصغرة وقابلة للتحريك",
        print: `حفظ كـ PDF على سطح المكتب / طباعة`,
        printHint: "فتح نافذة المتصفح للحفظ بصيغة PDF أو الطباعة",
        all: `تصدير جميع الصفحات المتاحة (${eligiblePageCount})`,
        working: `جارٍ تجهيز الصورة ${progress?.completed ?? 0} / ${progress?.total ?? 0}`,
        scope: "أداة لقطة مصغرة بحجم صغير قابلة للسحب والتحريك بحرية في أي مكان.",
        dragTooltip: "اضغط واسحب لتحريك الأداة في أي مكان بالشاشة",
        minimizeTooltip: "تصغير إلى زر عائم",
        expandTooltip: "تكبير المعاينة",
        closeTooltip: "إغلاق",
        saveJpg: "حفظ JPG",
        copyBtn: "نسخ",
        copied: "تم النسخ!",
        retake: "لقطة جديدة",
        snapshotTitle: "لقطة الشاشة",
      }
    : {
        title: `Export & screenshot full ${label}`,
        quickSave: `Direct Save to Desktop (JPG)`,
        quickSaveHint: "Instant download with compact movable widget",
        print: `Save as PDF / Print`,
        printHint: "Native browser PDF export or printer",
        all: `Export permitted pages (${eligiblePageCount})`,
        working: `Capturing ${progress?.completed ?? 0} / ${progress?.total ?? 0}`,
        scope: "Compact movable snapshot widget that can be dragged anywhere.",
        dragTooltip: "Click and drag to move anywhere on screen",
        minimizeTooltip: "Minimize to floating button",
        expandTooltip: "Expand preview",
        closeTooltip: "Close",
        saveJpg: "Save JPG",
        copyBtn: "Copy",
        copied: "Copied!",
        retake: "New Shot",
        snapshotTitle: "Snapshot",
      };

  const handleTriggerExport = async () => {
    setOpen(false);
    setIsCapturing(true);
    setIsMinimized(false);
    try {
      const res = await onExportCurrent();
      if (res && res.dataUrl) {
        setPreview({ dataUrl: res.dataUrl, filename: res.filename || `ejaz-${surface}` });
        return;
      }

      const root = getExportRoot();
      const dataUrl = await capturePageJpeg(root);
      const filename = `ejaz-${label}-snapshot`;
      downloadJpeg(dataUrl, filename);
      setPreview({ dataUrl, filename });
    } catch {
      onPrint();
    } finally {
      setIsCapturing(false);
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    // Only drag with primary mouse button / touch
    if (e.button !== 0) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentCoords.x,
      initialY: currentCoords.y,
    };
    setIsDragging(true);
  };

  const isWorking = busy || isCapturing;

  // Floating movable widget rendered via portal to prevent header-trapping
  const floatingWidget = preview && typeof document !== "undefined" ? (
    createPortal(
      <div
        className={cn(
          "fixed z-[100] select-none touch-none transition-shadow",
          isDragging ? "cursor-grabbing" : ""
        )}
        style={{
          left: `${currentCoords.x}px`,
          top: `${currentCoords.y}px`,
        }}
        data-export-exclude="true"
      >
        {isMinimized ? (
          /* Minimized Floating Bubble Mode (بحجم صغير جداً 46px مع إمكانية السحب والتحريك بحرية) */
          <div
            onPointerDown={startDrag}
            className={cn(
              "group relative flex h-12 w-12 items-center justify-center rounded-full border border-brand/50 bg-[#091426]/95 text-brand shadow-lg shadow-black/60 backdrop-blur-xl ring-1 ring-white/10 cursor-grab active:cursor-grabbing hover:border-brand hover:scale-105 transition-all",
              isDragging && "ring-2 ring-brand scale-105 shadow-brand/40"
            )}
            title={copy.dragTooltip}
          >
            <span className="absolute -top-0.5 -end-0.5 h-3 w-3 rounded-full bg-brand animate-ping opacity-75" />
            <span className="absolute -top-0.5 -end-0.5 h-3 w-3 rounded-full bg-brand ring-2 ring-surface-0" />
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              onClick={(e) => {
                // If user tapped without dragging, expand
                if (!isDragging) {
                  e.stopPropagation();
                  setIsMinimized(false);
                }
              }}
              className="cursor-pointer"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        ) : (
          /* Super-Compact Card Mode (بحجم صغير وأنيق وقابل للتحريك في أي مكان) */
          <div
            className={cn(
              "relative flex flex-col rounded-card border border-brand/40 bg-[#071120]/95 backdrop-blur-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 transition-all",
              isDragging && "ring-2 ring-brand shadow-[0_16px_50px_rgba(255,107,26,0.3)]",
              isExpanded ? "w-96 sm:w-[460px] max-w-[calc(100vw-24px)]" : "w-68 sm:w-72"
            )}
          >
            {/* Draggable Title Strip (اسحب من هنا للتحريك بسلاسة) */}
            <div
              onPointerDown={startDrag}
              className="flex items-center justify-between border-b border-white/[0.08] px-2.5 py-1.5 bg-surface-2/70 rounded-t-card cursor-grab active:cursor-grabbing hover:bg-surface-2 transition-colors select-none"
              title={copy.dragTooltip}
            >
              {/* Drag Grip + Title */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-text-muted hover:text-brand flex items-center" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="2" />
                    <circle cx="15" cy="6" r="2" />
                    <circle cx="9" cy="12" r="2" />
                    <circle cx="15" cy="12" r="2" />
                    <circle cx="9" cy="18" r="2" />
                    <circle cx="15" cy="18" r="2" />
                  </svg>
                </span>
                <span className="text-label font-extrabold text-white truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  {copy.snapshotTitle}
                </span>
                <span className="text-micro text-text-muted font-normal hidden sm:inline truncate">
                  ({isArabic ? "اسحب لتحريكها" : "Drag to move"})
                </span>
              </div>

              {/* Window Controls */}
              <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                {/* Minimize to mini floating bubble */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="grid h-5 w-5 place-items-center rounded-inner text-text-secondary hover:bg-white/10 hover:text-white transition-colors"
                  title={copy.minimizeTooltip}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                {/* Expand / Collapse zoom */}
                <button
                  type="button"
                  onClick={() => setIsExpanded((v) => !v)}
                  className="grid h-5 w-5 place-items-center rounded-inner text-text-secondary hover:bg-white/10 hover:text-white transition-colors"
                  title={copy.expandTooltip}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    {isExpanded ? (
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    ) : (
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    )}
                  </svg>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                  }}
                  className="grid h-5 w-5 place-items-center rounded-inner text-text-secondary hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title={copy.closeTooltip}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Compact Body: Thumbnail Preview + Direct Action Controls */}
            <div className="p-2 space-y-2">
              <div className="flex items-center gap-2">
                {/* Mini Clickable Thumbnail */}
                <div
                  onClick={() => setIsExpanded((v) => !v)}
                  className="relative shrink-0 w-16 h-12 rounded-inner overflow-hidden border border-white/15 bg-black/50 cursor-pointer group shadow-sm hover:border-brand/60 transition-colors"
                  title={isArabic ? "انقر لتكبير المعاينة" : "Click to zoom preview"}
                >
                  <img
                    src={preview.dataUrl}
                    alt="Page snapshot"
                    className="h-full w-full object-cover object-top transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {/* Instant Direct JPG Download */}
                    <a
                      href={preview.dataUrl}
                      download={`${preview.filename}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 rounded-inner bg-brand px-2 py-1 text-label font-extrabold text-navy hover:bg-brand-soft shadow transition-all active:scale-95"
                      title={copy.quickSaveHint}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                        <path d="M5 17v3h14v-3" />
                      </svg>
                      <span className="truncate">{copy.saveJpg}</span>
                    </a>

                    {/* PDF Button */}
                    <button
                      type="button"
                      onClick={() => onPrint()}
                      className="flex items-center justify-center gap-0.5 rounded-inner border border-sky-400/35 bg-sky-400/10 px-1.5 py-1 text-label font-bold text-sky-300 hover:bg-sky-400 hover:text-navy transition-all active:scale-95 shrink-0"
                      title={copy.printHint}
                    >
                      <span>PDF</span>
                    </button>

                    {/* Copy to Clipboard Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyImageToClipboard(preview.dataUrl);
                        setCopied(ok);
                        window.setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center justify-center gap-0.5 rounded-inner border border-white/15 bg-white/5 px-1.5 py-1 text-label font-bold text-text-primary hover:bg-white/10 transition-all active:scale-95 shrink-0"
                      title={isArabic ? "نسخ الصورة للحافظة" : "Copy to clipboard"}
                    >
                      <span>{copied ? "✓" : copy.copyBtn}</span>
                    </button>
                  </div>

                  {/* Retake Snapshot row */}
                  <div className="flex items-center justify-between text-micro text-text-secondary px-0.5">
                    <button
                      type="button"
                      onClick={handleTriggerExport}
                      className="text-brand hover:underline font-semibold flex items-center gap-0.5 truncate"
                    >
                      <span>↻</span>
                      <span>{copy.retake}</span>
                    </button>
                    <span className="text-text-muted truncate">
                      {isArabic ? "مباشر للجهاز" : "Direct save"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional Expanded Preview Image Area (عند الضغط على تكبير المعاينة) */}
              {isExpanded && (
                <div className="pt-1 border-t border-white/[0.08]">
                  <div className="flex justify-center overflow-auto max-h-56 rounded-inner border border-white/10 bg-black/50 p-1">
                    <img
                      src={preview.dataUrl}
                      alt="Full Page Preview"
                      className="rounded-inner object-contain max-h-52 w-auto"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      <div className={cn("relative inline-block", className)} ref={rootRef} data-export-exclude="true">
        <button
          type="button"
          aria-label={isWorking ? copy.working : copy.title}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-busy={isWorking}
          disabled={isWorking}
          title={isWorking ? copy.working : copy.title}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "btn-icon relative shrink-0 rounded-full border border-white/[0.14] bg-surface-2/80 text-text-secondary hover:bg-surface-3 hover:text-text-primary hover:border-brand/60 hover:shadow-brand/20 shadow-sm backdrop-blur-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-80",
            open && "border-brand text-brand bg-brand/10 shadow-brand/30",
            buttonClassName
          )}
        >
          {isWorking ? (
            <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-brand border-t-transparent animate-spin" />
          ) : (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </button>

        {isWorking && progress && (
          <span className="absolute -bottom-1 -end-1 min-w-4 rounded-full bg-brand px-1 text-center text-micro font-bold leading-4 text-white shadow-sm">
            {progress.completed}/{progress.total}
          </span>
        )}

        {open && !isWorking && (
          <div
            role="menu"
            aria-label={copy.title}
            className="animate-fade-in absolute end-0 top-[calc(100%+10px)] z-[90] w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-panel border border-white/12 bg-[#091322]/95 backdrop-blur-xl p-2 shadow-2xl shadow-black/70 ring-1 ring-white/5"
          >
            <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
              <div className="text-label-lg font-extrabold text-text-primary flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-brand animate-pulse" />
                {copy.title}
              </div>
              <div className="text-micro text-text-muted mt-0.5">{copy.scope}</div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={handleTriggerExport}
              className="flex w-full items-start gap-3 rounded-inner p-2.5 text-start hover:bg-white/[0.08] transition-colors group"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-inner bg-brand/15 text-brand border border-brand/30 group-hover:bg-brand group-hover:text-navy transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                  <path d="M5 17v3h14v-3" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-body font-bold text-text-primary group-hover:text-brand transition-colors">
                  {copy.quickSave}
                </div>
                <div className="text-micro text-text-secondary mt-0.5">{copy.quickSaveHint}</div>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPrint();
              }}
              className="flex w-full items-start gap-3 rounded-inner p-2.5 text-start hover:bg-white/[0.08] transition-colors group mt-1"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-inner bg-sky-400/15 text-sky-300 border border-sky-400/30 group-hover:bg-sky-400 group-hover:text-navy transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2" />
                  <path d="M7 14h10v7H7zM17 11h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-body font-bold text-text-primary group-hover:text-sky-300 transition-colors">
                  {copy.print}
                </div>
                <div className="text-micro text-text-secondary mt-0.5">{copy.printHint}</div>
              </div>
            </button>

            {eligiblePageCount > 1 && (
              <>
                <div className="my-1.5 border-t border-white/[0.08]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onExportAll();
                  }}
                  className="flex w-full items-start gap-3 rounded-inner p-2.5 text-start hover:bg-white/[0.08] transition-colors group"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-inner bg-violet-400/15 text-violet-300 border border-violet-400/30 group-hover:bg-violet-400 group-hover:text-navy transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-bold text-text-primary group-hover:text-violet-300 transition-colors">
                      {copy.all}
                    </div>
                    <div className="text-micro text-text-secondary mt-0.5">
                      {isArabic ? "تصدير كل شاشات المنصة في ملف مضغوط ZIP" : "Export all permitted pages as ZIP"}
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {floatingWidget}
    </>
  );
}
