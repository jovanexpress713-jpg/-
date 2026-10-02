import type { RouteShape } from "./types";

/** Real Saudi city coordinates (lat, lng). */
export const CITIES: Record<string, [number, number]> = {
  Riyadh: [24.7136, 46.6753],
  Jeddah: [21.4858, 39.1925],
  Dammam: [26.4207, 50.0888],
  Makkah: [21.3891, 39.8579],
  Madinah: [24.5247, 39.6125],
  Jubail: [27.0046, 50.1029],
  Tabuk: [28.3835, 36.5667],
  Taif: [21.2667, 40.4167],
  Abha: [18.2167, 42.5],
  NEOM: [28.0, 35.4],
  Hail: [27.5167, 41.7],
  Buraydah: [26.3283, 43.9667],
  Yanbu: [24.0943, 38.0636],
  Hofuf: [25.3833, 49.5833],
  Khamis: [18.3, 42.7333],
  Riyadh2: [24.7136, 46.6753],
};

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** viewBox 0 0 400 260 — Saudi Arabia bounds: lng 33→58.8, lat 33.5→16.7 */
const K = 15.5;
export function project(lat: number, lng: number): [number, number] {
  return [(lng - 33) * K, (33.5 - lat) * K];
}

/** Stylised outline of the Kingdom (lng, lat) → used as the map's land mass. */
export const KSA_OUTLINE: [number, number][] = [
  [34.9, 29.4],
  [36.5, 31.5],
  [38.2, 31.6],
  [40.5, 31.2],
  [42.4, 31.1],
  [44.7, 29.2],
  [46.5, 29.1],
  [48.5, 28.4],
  [48.7, 29.5],
  [47.8, 30.1],
  [48.1, 29.2],
  [50.1, 26.4],
  [50.7, 25.3],
  [51.6, 24.6],
  [52.6, 24.1],
  [54.4, 22.7],
  [55.7, 22.0],
  [56.4, 24.4],
  [55.2, 24.9],
  [54.0, 23.0],
  [52.1, 21.1],
  [51.1, 19.6],
  [48.0, 18.2],
  [45.4, 17.4],
  [43.5, 17.4],
  [42.8, 16.4],
  [41.4, 17.4],
  [40.4, 18.7],
  [39.2, 21.4],
  [38.6, 22.0],
  [37.0, 25.0],
  [36.1, 27.1],
  [35.2, 28.1],
  [34.9, 29.4],
];

/** Three real inter-city corridors used across the fleet. */
export const CORRIDORS: [string, string][] = [
  ["Riyadh", "Jeddah"],
  ["Dammam", "Riyadh"],
  ["Jeddah", "Madinah"],
];

export const ROUTES: RouteShape[] = [
  { key: "r1", points: [], areas: [] },
  { key: "r2", points: [], areas: [] },
  { key: "r3", points: [], areas: [] },
];

export function routeByKey(key: string): RouteShape {
  return ROUTES.find((r) => r.key === key) ?? ROUTES[0];
}

/** Point at `t` (0..1) along a polyline. */
export function pointAt(
  points: [number, number][],
  t: number,
): { x: number; y: number; angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0][0], y: points[0][1], angle: 0 };
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    segs.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const p = target / segs[i];
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      return {
        x: x1 + (x2 - x1) * p,
        y: y1 + (y2 - y1) * p,
        angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
      };
    }
    target -= segs[i];
  }
  const last = points[points.length - 1];
  return { x: last[0], y: last[1], angle: 0 };
}

export function pathFrom(points: [number, number][]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
}
