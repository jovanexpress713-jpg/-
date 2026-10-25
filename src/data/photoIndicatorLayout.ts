import type { FleetIndicatorKey } from "./interactiveIndicators";

export interface PhotoIndicatorPosition {
  x: number;
  y: number;
  anchor: "left" | "right";
}

/** Stable, responsive percentage anchors for the interactive indicators over a vehicle photo. */
export const PHOTO_INDICATOR_POSITIONS: Record<FleetIndicatorKey, PhotoIndicatorPosition> = {
  speed: { x: 18, y: 26, anchor: "left" },
  fuel: { x: 82, y: 24, anchor: "right" },
  load: { x: 62, y: 57, anchor: "right" },
  eta: { x: 18, y: 70, anchor: "left" },
  engine: { x: 82, y: 70, anchor: "right" },
  distance: { x: 50, y: 78, anchor: "right" },
};

export function getPhotoIndicatorPosition(key: FleetIndicatorKey): PhotoIndicatorPosition {
  return PHOTO_INDICATOR_POSITIONS[key];
}
