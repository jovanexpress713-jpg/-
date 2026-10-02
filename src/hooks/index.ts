import { useEffect, useRef, useState } from "react";

const MOUNT = Date.now();

/** One shared clock — every live widget on screen reads from it. */
export function useTicker(intervalMs = 1000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function useElapsed(now: number): number {
  return Math.max(0, (now - MOUNT) / 1000);
}

export interface Live {
  progress: number;
  speed: number;
  etaSeconds: number;
  miles: number;
}

export function liveOf(
  v: {
    status: string;
    progress: number;
    speed: number;
    etaMinutes: number;
    milesLeft: number;
  },
  elapsed: number,
): Live {
  if (v.status !== "active") {
    return { progress: v.progress, speed: 0, etaSeconds: v.etaMinutes * 60, miles: v.milesLeft };
  }
  const progress = Math.min(99.2, v.progress + elapsed * 0.006);
  const etaSeconds = Math.max(0, v.etaMinutes * 60 - elapsed);
  const total = v.etaMinutes * 60 || 1;
  const miles = Math.max(0, v.milesLeft * (etaSeconds / total));
  const speed = v.speed + Math.sin(elapsed / 2.6) * 3.2 + Math.sin(elapsed / 7) * 1.4;
  return { progress, speed: Math.max(0, speed), etaSeconds, miles };
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

/** Counts 0 → target once visible. */
export function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || done.current) return;
        done.current = true;
        const start = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(target * eased);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return value;
}

/** Small helper for delayed reactions (auto-replies, toasts…). */
export function useTimeoutFn(cb: () => void, ms: number | null) {
  const saved = useRef(cb);
  saved.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setTimeout(() => saved.current(), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
}
