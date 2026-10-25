# EJAZ AR Reality Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make EJAZ an AR-first fleet command center where the truck is the primary visual object and route, load, fuel, speed, maintenance, weather and operating state are trustworthy layers around it.

**Architecture:** Preserve the existing stores, API contracts, RBAC, trips, vehicles and LiveOperationsCenter. Add a shared AR/reality scene layer that consumes those existing contracts, reuses the official vehicle asset registry, and exposes a real WebXR camera session only when the device/browser supports it. Desktop remains a high-fidelity 3D command center; mobile can enter true camera AR.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Three.js 0.186, existing EJAZ fleet stores/API, WebXR APIs without adding a second telemetry source of truth.

**Spec:** `docs/superpowers/specs/2026-10-25-ejaz-ar-reality.md`

## Global Constraints

- Preserve existing business logic, permissions, API contracts, and navigation behavior.
- Never present simulated GPS, weather, or telemetry as live data.
- Prefer official published GLB/GLTF assets from the existing vehicle asset registry.
- Never label procedural fallback geometry as an official Volvo/Mercedes model.
- Support curtain, dry, reefer, and flatbed body types.
- The interface must remain usable from narrow mobile widths through large desktop screens.
- Every interactive control must work by tap/click and respect reduced-motion preferences.
- Arabic RTL remains primary; English remains available through existing settings/localization.
- AR must fail honestly on unsupported devices, browsers, insecure contexts, or unavailable camera permissions.

## Review Focus

- No-GPS configuration must show an honest non-live state rather than fake movement.
- Missing 3D models must fall back to the official vehicle image without claiming realism it does not have.
- Four vehicle body types must remain visually distinguishable.
- 360-degree rotation, zoom, auto-rotation, touch and pointer interaction must remain functional.
- AR session start/exit must handle unsupported browsers and permission failure without breaking the normal dashboard.
- Dense reality overlays must reflow without clipping or horizontal page overflow.

---

### Task 1: Reality Command Deck

**Files:**
- Create/modify: `src/components/RealityCommandDeck.tsx`
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `Vehicle[]`, selected vehicle, existing navigation/select/toast callbacks.
- Produces: responsive truck-first command center with 3D vehicle hero, telemetry overlays, fleet health, route context and AR entry point.

- [ ] Keep the selected truck as the visual center of the dashboard.
- [ ] Bind load, fuel, speed and remaining distance to existing vehicle fields.
- [ ] Keep route progress based on `Vehicle.progress` and do not synthesize movement.
- [ ] Add explicit operating states for moving, stopped/waiting, inactive and attention-required.
- [ ] Add environment state presentation that is clearly labelled live, unavailable or simulation.
- [ ] Keep 360-degree/zoom controls visible and usable.

### Task 2: True Mobile AR Layer

**Files:**
- Create: `src/components/ARTruckExperience.tsx`
- Create: `src/components/ar/webxr.ts`
- Create: `src/components/ar/types.ts`
- Modify: `src/components/RealityCommandDeck.tsx`

**Interfaces:**
- `detectARSupport(): Promise<{supported:boolean; reason:string}>`
- `startARSession(options): Promise<XRSession>` when WebXR immersive-ar is available.
- `ARTruckExperience` consumes the selected vehicle and official model descriptor and emits session status/exit callbacks.

- [ ] Detect secure context, `navigator.xr`, immersive-ar support, and camera/session failures.
- [ ] Start a real immersive AR session using Three.js WebXR renderer only on supported devices.
- [ ] Load the selected official GLB/GLTF when available; otherwise clearly show a model-unavailable state instead of pretending a procedural truck is manufacturer-accurate.
- [ ] Render truck-anchored telemetry labels for load, fuel, speed and maintenance only when data exists.
- [ ] Provide exit/close controls and restore the normal 3D command deck after session end.
- [ ] Keep the AR layer optional so desktop and unsupported mobile browsers remain fully usable.

### Task 3: Asset and Vehicle Reality Contract

**Files:**
- Modify: `src/state/vehicleAssetStore.tsx`
- Modify: `src/data/types.ts` only if a missing non-breaking type is required.
- Create: `src/data/vehicleReality.ts`

**Interfaces:**
- `getRealityAsset(vehicle): { modelUrl|null; modelSource; imageUrl; bodyType; manufacturer; modelName; isOfficialModel }`

- [ ] Centralize the truth about whether a model is official, fallback, unavailable or simulation.
- [ ] Preserve existing asset registry API behavior.
- [ ] Expose manufacturer/model metadata without forcing fake values when unknown.
- [ ] Keep the four body types normalized through the existing vehicle type helpers.

### Task 4: Reality Visual System

**Files:**
- Modify: `src/index.css`

- [ ] Add responsive reality-stage, telemetry callout, AR action and environment-state styles.
- [ ] Keep the existing design-token system and avoid global theme regressions.
- [ ] Add mobile/tablet/desktop breakpoints for the dense overlay layout.
- [ ] Respect reduced-motion preferences.

### Task 5: Tests and Verification

**Files:**
- Create: `tests/arRealityTests.ts`
- Modify: `tests/runAllTests.ts` only if the existing runner requires registration.
- Existing `.github/workflows/verify-reality-redesign.yml`.

- [ ] Test vehicle reality metadata for all four body types.
- [ ] Test unsupported AR returns a safe reason rather than throwing.
- [ ] Test missing model data never claims an official model.
- [ ] Test telemetry calculations clamp/format values safely.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Inspect branch diff and workflow status before claiming completion.
