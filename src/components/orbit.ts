/**
 * EJAZ Transport — 3D orbit integrator.
 *
 * Extracted verbatim from the vehicle viewer's animation loop so the rotation
 * behaviour can be exercised by the test suite through the *same* functions the
 * renderer calls — not a re-implementation of them.
 *
 * The model itself is never touched here: this module only moves the camera.
 */

export interface OrbitState {
  /** Distance from the look-at point. */
  radius: number;
  /** Azimuth, radians. Unclamped — it simply wraps, which is what allows 360°. */
  theta: number;
  /** Polar angle from +Y, radians. Small = looking down at the roof. */
  phi: number;
}

export interface OrbitVelocity {
  theta: number;
  phi: number;
}

export interface OrbitOptions {
  /** Exponential follow rate: how quickly the camera catches the drag target. */
  follow: number;
  /** How quickly released-drag inertia settles. */
  friction: number;
  /** Radians of rotation per pixel of drag. */
  speed: number;
  /** Auto-spin rate, rad/s. */
  autoRotateSpeed: number;
  /** Idle delay before auto-spin resumes, ms. */
  autoRotateResumeMs: number;
  minRadius: number;
  maxRadius: number;
  /** Near-top polar limit — keeps the roof reachable. */
  minPolar: number;
  /** Just below the horizon — keeps the wheels reachable. */
  maxPolar: number;
}

export const ORBIT_DEFAULTS: OrbitOptions = {
  follow: 14,
  friction: 4.2,
  speed: 0.0075,
  autoRotateSpeed: 0.35,
  autoRotateResumeMs: 2600,
  minRadius: 12,
  maxRadius: 40,
  minPolar: 0.16,
  maxPolar: 1.62,
};

export const clampPolar = (phi: number, o: OrbitOptions = ORBIT_DEFAULTS) =>
  Math.max(o.minPolar, Math.min(o.maxPolar, phi));

export const clampRadius = (radius: number, o: OrbitOptions = ORBIT_DEFAULTS) =>
  Math.max(o.minRadius, Math.min(o.maxRadius, radius));

/**
 * Applies one pointer-drag delta to the target orbit. The camera itself eases
 * towards this target in `stepOrbit`, which is what makes the motion smooth
 * rather than snapping to the cursor.
 */
export function applyDragDelta(
  target: OrbitState,
  dxPx: number,
  dyPx: number,
  o: OrbitOptions = ORBIT_DEFAULTS
): void {
  target.theta -= dxPx * o.speed;
  target.phi = clampPolar(target.phi - dyPx * o.speed, o);
}

export interface StepOrbitInput {
  /** Frame delta in seconds (already clamped by the caller). */
  dt: number;
  /** Monotonic clock, ms. */
  now: number;
  dragging: boolean;
  autoRotate: boolean;
  /** Timestamp of the last user interaction, ms. */
  lastInteraction: number;
}

/**
 * Advances one frame: carry released-drag inertia, resume auto-spin once the
 * operator has let go, then ease the camera towards the target.
 *
 * The follow term is `1 - exp(-k·dt)`, so the perceived responsiveness is
 * identical at 60Hz and 120Hz.
 */
export function stepOrbit(
  current: OrbitState,
  target: OrbitState,
  velocity: OrbitVelocity,
  input: StepOrbitInput,
  o: OrbitOptions = ORBIT_DEFAULTS
): void {
  const { dt, now, dragging, autoRotate, lastInteraction } = input;

  // Enforce the envelope here as well as at the call sites, so no caller can
  // push the camera outside it — a published GLB camera radius or a future
  // control still cannot exceed the zoom or polar limits.
  target.radius = clampRadius(target.radius, o);
  target.phi = clampPolar(target.phi, o);

  if (!dragging) {
    if (Math.abs(velocity.theta) > 1e-4 || Math.abs(velocity.phi) > 1e-4) {
      target.theta += velocity.theta * dt;
      target.phi = clampPolar(target.phi + velocity.phi * dt, o);
      const decay = Math.exp(-o.friction * dt);
      velocity.theta *= decay;
      velocity.phi *= decay;
    } else if (autoRotate && now - lastInteraction > o.autoRotateResumeMs) {
      target.theta += o.autoRotateSpeed * dt;
    }
  }

  const k = 1 - Math.exp(-o.follow * dt);
  current.theta += (target.theta - current.theta) * k;
  current.phi += (target.phi - current.phi) * k;
  current.radius += (target.radius - current.radius) * k;
}

/** Camera position for an orbit state, in scene units. */
export function orbitToPosition(
  state: OrbitState,
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
) {
  const sinPhi = Math.sin(state.phi);
  out.x = state.radius * sinPhi * Math.sin(state.theta);
  out.y = state.radius * Math.cos(state.phi);
  out.z = state.radius * sinPhi * Math.cos(state.theta);
  return out;
}

/**
 * Azimuth in degrees, normalized to [0, 360). Surfaced in the viewer HUD so the
 * operator can see the full turn being covered.
 */
export function azimuthDegrees(theta: number): number {
  const deg = ((theta * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}
