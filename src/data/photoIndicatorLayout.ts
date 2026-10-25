import type { FleetIndicatorKey } from "./interactiveIndicators";

export interface PhotoIndicatorPosition {
  x: number;
  y: number;
  anchor: "left" | "right";
}

/** Stable percentage anchors for the six interactive indicators over a truck photo. */
export const PHOTO_INDICATOR_POSITIONS: Record<FleetIndicatorKey, PhotoIndicatorPosition> = {
  speed: { x: 17, y: 26, anchor: "left" },
  fuel: { x: 18, y: 58, anchor: "left" },
  load: { x: 73, y: 27, anchor: "right" },
  eta: { x: 74, y: 57, anchor: "right" },
  engine: { x: 52, y: 72, anchor: "right" },
  distance: { x: 51, y: 17, anchor: "right" },
};

export function getPhotoIndicatorPosition(key: FleetIndicatorKey): PhotoIndicatorPosition {
  return PHOTO_INDICATOR_POSITIONS[key];
}
