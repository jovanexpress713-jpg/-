import { useEffect, useRef, useState } from "react";
import type { Trip, TripStatus } from "../../state/fleetStore";

export type StatusGroup = "pending" | "transit" | "delivered" | "cancelled";

export function statusGroup(status: TripStatus): StatusGroup {
  switch (status) {
    case "on_road":
    case "stopped":
      return "transit";
    case "arrived":
    case "delivered":
    case "completed":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export const STATUS_LABEL: Record<TripStatus, [string, string]> = {
  new: ["New", "جديدة"],
  planning: ["Planning", "تخطيط"],
  loading: ["Loading", "تحميل"],
  ready: ["Ready", "جاهزة"],
  on_road: ["On Route", "على الطريق"],
  stopped: ["Stopped", "متوقفة"],
  arrived: ["Arrived", "وصلت"],
  delivered: ["Delivered", "تم التسليم"],
  completed: ["Completed", "مكتملة"],
  cancelled: ["Cancelled", "ملغاة"],
};

export const GROUP_TONE: Record<StatusGroup, string> = {
  pending: "bg-status-waiting/15 text-status-waiting",
  transit: "bg-brand/15 text-brand",
  delivered: "bg-status-active/15 text-status-active",
  cancelled: "bg-status-danger/15 text-status-danger",
};

export const CARGO_LABEL: Record<string, [string, string]> = {
  flatbed: ["Flatbed", "سطحة"],
  reefer: ["Reefer", "مبرد"],
  dry: ["Dry Box", "صندوق جاف"],
  curtain: ["Curtain", "ستارة"],
};

export function truckImage(cargoType: string) {
  const id = ["flatbed", "reefer", "dry", "curtain"].includes(cargoType) ? cargoType : "dry";
  return `/images/trucks/official/official-${id}.webp`;
}

export function loadPct(trip: Trip) {
  if (!trip.maxCapacityTons) return 0;
  return Math.min(100, Math.round((trip.cargoWeightTons / trip.maxCapacityTons) * 100));
}

export function formatEta(minutes: number, t: (en: string, ar: string) => string) {
  if (!minutes || minutes <= 0) return t("Arrived", "وصلت");
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? t(`${h}h ${m}m`, `${h} س ${m} د`) : t(`${m}m`, `${m} د`);
}

/** Smoothly animates a number toward `target` whenever it changes. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      fromRef.current = next;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
