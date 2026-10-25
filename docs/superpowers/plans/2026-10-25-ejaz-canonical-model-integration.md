# EJAZ Canonical Fleet Model Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the four generated EJAZ canonical OBJ truck assets into the real 3D command-center viewer without misrepresenting them as licensed Volvo/Mercedes manufacturer assets.

**Architecture:** Keep the existing official GLB/GLTF registry path unchanged. Add a separate canonical-model descriptor and a focused Three.js OBJ viewer that loads the EJAZ-owned assets by body type, while retaining the existing viewer as the fallback/reference path elsewhere. The command deck will use the canonical viewer for its interactive 360° surface; AR will continue to require an official GLB/GLTF asset.

**Tech Stack:** React 19, TypeScript 5.9, Three.js 0.186, Vite, existing EJAZ vehicle type registry.

**Spec:** EJAZ reality command center requirements in the current conversation and `public/models/ejaz/manifest.json`.

## Global Constraints

- Canonical assets are project-generated EJAZ geometry and must never be labeled official Volvo/Mercedes models.
- Official manufacturer AR remains disabled unless an official GLB/GLTF is actually registered.
- All four canonical body types must resolve to the checked-in OBJ assets.
- Existing vehicle telemetry remains backend-derived; no synthetic GPS/weather is introduced.
- Preserve the existing WebGL context budget and responsive command-center behavior.

## Review Focus

- Unknown vehicle type: viewer must use a safe fallback rather than crash.
- Missing OBJ/network failure: show the existing reference/fallback presentation.
- Rapid type changes: dispose old OBJ scene resources and avoid stale models.
- AR state: canonical OBJ must not be presented as official manufacturer AR geometry.
- WebGL context limits: the new surface must not create unbounded renderers.

### Task 1: Canonical model registry

**Files:**
- Modify: `src/state/vehicleAssetStore.tsx`
- Create: `src/data/canonicalVehicleModels.ts`

Add a separate canonical descriptor with body-type-to-OBJ mappings. Keep `VehicleModelAsset` restricted to official GLB/GLTF assets so existing server contracts are not widened.

### Task 2: Canonical Three.js viewer

**Files:**
- Create: `src/components/CanonicalVehicle3DViewer.tsx`
- Test: `tests/canonicalVehicleModels.test.ts`

Load OBJ assets with `OBJLoader`, normalize/center them, apply body-specific materials, provide smooth orbit/zoom/auto-rotation, and fall back cleanly to the supplied vehicle image if WebGL or asset loading fails.

### Task 3: Command-center integration

**Files:**
- Modify: `src/components/RealityCommandDeck.tsx`

Use the canonical viewer as the interactive 360° command-center surface while keeping the AR button gated by `reality.isOfficialModel && reality.modelUrl`.

### Task 4: Verification

Run TypeScript lint, the complete test suite, and Vite production build. Inspect the GitHub Actions run for the resulting commit and fix any failures before claiming completion.
