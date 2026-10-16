import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { capturePageJpeg, downloadJpegArchive, waitForPaint, type JpegPage } from "../services/pageExport";

export interface MobileExportStatus {
  busy: boolean;
  progress?: { completed: number; total: number } | null;
  done?: string;
  error?: string;
}

interface ExportJob<T extends string> {
  screens: readonly T[];
  previousScreen: T;
  index: number;
  pages: JpegPage[];
  capturePending: boolean;
}

/**
 * Bulk-captures each route in a mobile app without exposing routes that do not
 * belong to that app. The active tab is restored when the ZIP is ready.
 */
export function useMobileScreenExport<T extends string>({
  signal,
  screens,
  activeScreen,
  setActiveScreen,
  filename,
  onStatus,
}: {
  signal: number;
  screens: readonly T[];
  activeScreen: T;
  setActiveScreen: Dispatch<SetStateAction<T>>;
  filename: string;
  onStatus?: (status: MobileExportStatus) => void;
}): void {
  const jobRef = useRef<ExportJob<T> | null>(null);
  const lastSignal = useRef(0);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  useEffect(() => {
    if (!signal || signal === lastSignal.current) return;
    lastSignal.current = signal;
    if (jobRef.current) return;
    if (!screens.length) {
      statusRef.current?.({ busy: false, error: "لا توجد شاشات متاحة للتصدير." });
      return;
    }

    const job: ExportJob<T> = {
      screens,
      previousScreen: activeScreen,
      index: 0,
      pages: [],
      capturePending: false,
    };
    jobRef.current = job;
    statusRef.current?.({ busy: true, progress: { completed: 0, total: screens.length } });
    setActiveScreen(screens[0]);
  }, [signal, screens, activeScreen, setActiveScreen]);

  useEffect(() => {
    const job = jobRef.current;
    if (!job || job.capturePending) return;
    const screen = job.screens[job.index];
    if (activeScreen !== screen) {
      setActiveScreen(screen);
      return;
    }

    job.capturePending = true;
    let cancelled = false;

    const capture = async () => {
      try {
        // Let tab content and its data effects settle before taking the image.
        await waitForPaint(500);
        if (cancelled || jobRef.current !== job) return;
        const dataUrl = await capturePageJpeg();
        if (cancelled || jobRef.current !== job) return;

        job.pages.push({ name: `${filename}-${screen}`, dataUrl });
        job.index += 1;
        job.capturePending = false;
        statusRef.current?.({
          busy: true,
          progress: { completed: job.index, total: job.screens.length },
        });

        if (job.index < job.screens.length) {
          setActiveScreen(job.screens[job.index]);
          return;
        }

        const archiveName = await downloadJpegArchive(job.pages, filename);
        if (jobRef.current !== job) return;
        jobRef.current = null;
        setActiveScreen(job.previousScreen);
        statusRef.current?.({ busy: false, progress: null, done: archiveName });
      } catch (error) {
        if (jobRef.current !== job) return;
        jobRef.current = null;
        setActiveScreen(job.previousScreen);
        statusRef.current?.({
          busy: false,
          progress: null,
          error: error instanceof Error ? error.message : "تعذّر تصدير شاشات الجوال.",
        });
      }
    };

    void capture();
    return () => {
      cancelled = true;
    };
  }, [activeScreen, filename, setActiveScreen]);
}
