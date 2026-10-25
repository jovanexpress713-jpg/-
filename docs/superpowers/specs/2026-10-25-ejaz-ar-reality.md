# EJAZ AR Reality Command Center — Design Spec

## Goal
Make the EJAZ transport platform AR-first: the truck is the primary visual object, while route, load, fuel, speed, maintenance, weather and operating state are rendered as trustworthy layers around that truck.

## Experience
- Desktop: Reality Command Center with an interactive 3D truck, route/map context, telemetry, environment state and operational alerts.
- Mobile: same 3D scene plus a real camera AR entry point when WebXR is supported; otherwise a clearly labelled 3D fallback.
- The truck must visually distinguish curtain, dry, reefer and flatbed bodies.
- Volvo/Mercedes identity is represented by licensed/official GLB/GLTF assets when published in the existing vehicle asset registry; no fake claim of manufacturer realism when only a fallback asset is available.
- 360° orbit, zoom, reset and auto-rotation remain available.
- Telemetry overlays include load, fuel, speed, distance, ETA and maintenance state only when the underlying data exists.
- GPS movement is driven by verified live/last-known data from the existing operations layer; no synthetic GPS is introduced.
- Weather/environment modes are data-backed when available. A visual simulation/demo mode may exist only when explicitly labelled as simulation.

## Architecture
Reuse the existing Vehicle3DViewer, VehicleAssetProvider and LiveOperationsCenter. Add an AR scene layer that consumes the same vehicle and telemetry contracts instead of creating a second source of truth. Keep the existing stores, API, RBAC, finance, trips and mobile routes intact.

## Visual language
Dark command-center surface, glass telemetry panels, restrained EJAZ orange accents, high contrast, Arabic RTL first, responsive from phone to wide desktop. Indicators should anchor to the truck or route rather than becoming disconnected dashboard cards.

## Safety / honesty rules
- Never label procedural geometry as an official Volvo/Mercedes model.
- Never label simulated movement, weather or telemetry as live.
- When AR/WebXR is unavailable, explain why and keep the normal 3D experience usable.
- When a metric is missing, show unavailable rather than inventing a value.

## Acceptance criteria
1. Dashboard communicates a truck-first operational story without requiring a user to open a secondary dashboard.
2. A selected vehicle exposes body type, load, fuel, speed, distance and maintenance context in the same scene.
3. 360°/zoom interactions work on pointer and touch-capable layouts without horizontal overflow.
4. AR entry point detects support honestly and starts an immersive session only on supported secure contexts.
5. Official published GLB/GLTF assets are preferred over procedural fallback assets.
6. Existing GPS provider truthfulness and RBAC are preserved.
7. TypeScript, tests and production build pass before the branch is considered ready.
