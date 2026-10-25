import assert from "node:assert/strict";
import { PHOTO_INDICATOR_POSITIONS, getPhotoIndicatorPosition } from "../src/data/photoIndicatorLayout";

export function runPhotoIndicatorLayoutTests() {
  const keys = Object.keys(PHOTO_INDICATOR_POSITIONS);
  assert.deepEqual(keys, ["speed", "fuel", "load", "eta", "engine", "distance"]);

  for (const key of keys) {
    const position = getPhotoIndicatorPosition(key as keyof typeof PHOTO_INDICATOR_POSITIONS);
    assert.ok(position.x >= 0 && position.x <= 100, `${key} x must be in percent bounds`);
    assert.ok(position.y >= 0 && position.y <= 100, `${key} y must be in percent bounds`);
    assert.ok(position.anchor === "left" || position.anchor === "right", `${key} anchor must be explicit`);
  }
}
