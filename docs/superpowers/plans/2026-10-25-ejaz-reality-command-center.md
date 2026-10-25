# EJAZ Reality Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the EJAZ dashboard experience around realistic fleet visualization, interactive 3D trucks, operational telemetry, responsive composition, and a consistent visual language while preserving the existing business functions.

**Architecture:** Keep the current stores, API contracts, RBAC, trip/vehicle data, and existing mobile surfaces. Replace the dashboard presentation layer with a focused Reality Command Deck and reuse the existing `Vehicle3DViewer` and `LiveOperationsCenter` instead of duplicating telemetry logic. The design must degrade honestly when real GPS or a published GLB asset is unavailable.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Three.js 0.186, existing EJAZ fleet stores and API client.

**Spec:** `docs/superpowers/plans/2026-10-25-ejaz-reality-command-center.md`

## Global Constraints

- Preserve existing business logic, permissions, API contracts, and navigation behavior.
- Do not present simulated GPS as live GPS.
- Use the existing official vehicle asset registry and `Vehicle3DViewer` as the 3D source of truth.
- Support the four approved vehicle categories: curtain, dry, reefer, and flatbed.
- The interface must remain usable from narrow mobile widths through large desktop screens.
- Every interactive control must work by tap/click and must respect reduced-motion preferences.
- Arabic RTL remains the primary presentation; English labels remain available through the existing localization system.

## Review Focus

- No-GPS configuration must show an honest non-live state rather than fake live telemetry.
- Missing 3D models must fall back cleanly to the official vehicle image.
- Four vehicle body types must remain visually distinguishable.
- 360-degree rotation, zoom, and auto-rotation must remain functional.
- Dense dashboard layouts must reflow without clipping or horizontal page overflow.

---

### Task 1: Reality Command Deck

**Files:**
- Create: `src/components/RealityCommandDeck.tsx`
- Modify: `src/components/views.tsx`

**Interfaces:**
- Consumes: `Vehicle[]`, current selected vehicle, existing `onSelect`, `onToast` callbacks.
- Produces: responsive dashboard UI with 3D vehicle hero, fleet health, route progress, and operational metrics.

- [ ] Create the new command deck as a presentation-only component.
- [ ] Use `Vehicle3DViewer` for the selected vehicle and expose rotation/zoom affordances.
- [ ] Add responsive metric rail for fleet count, active routes, utilization, fuel state, and maintenance attention.
- [ ] Add route progress cards using real fields from `Vehicle` without inventing live GPS claims.
- [ ] Add vehicle-type identity using the canonical vehicle type metadata.
- [ ] Add reduced-motion-safe micro-interactions.
- [ ] Replace the old `DashboardView` body with the new command deck while keeping the same callbacks.

### Task 2: Visual System Refinement

**Files:**
- Modify: `src/index.css`

- [ ] Add only the tokens/utilities needed for the new command deck: glass surfaces, telemetry lines, responsive 3D stage, and status indicators.
- [ ] Keep the existing design-token system and avoid hardcoded global theme overrides.
- [ ] Verify 320px, tablet, desktop, and wide-screen compositions.

### Task 3: Verification

**Files:**
- Existing test/build scripts in `package.json`.

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run the existing design-scale verification if applicable.
- [ ] Inspect the resulting branch diff and verify that only intended presentation files changed.
- [ ] Do not claim completion until all available checks pass.
