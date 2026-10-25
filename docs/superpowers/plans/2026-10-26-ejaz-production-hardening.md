# EJAZ Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the EJAZ transport platform for production use, preserve the verified interactive vehicle experience, remove unsafe demo/passwordless behavior from production paths, and make the 3D asset pipeline truthful and testable.

**Architecture:** Keep the current React/Vite + Express/TypeScript architecture. Make security behavior explicit at the API boundary, keep demo accounts opt-in for tests only, and make vehicle 3D assets data-driven with a verified local-asset registry rather than fake URLs. Use repository CI as the execution/verification environment.

**Tech Stack:** React 19, Vite 7, Express 5, TypeScript 5.9, Three.js 0.186, existing test harness, GitHub Actions.

**Spec:** Existing EJAZ project behavior plus PR #23 interactive capacity requirements and the production-hardening request.

## Global Constraints

- No passwordless privileged session creation.
- Demo credentials must never be enabled by default in production.
- No fake 3D asset URLs or claims of live vehicle telemetry.
- Existing interactive capacity visualization must remain explicitly based on stored fields.
- All changes must pass TypeScript, tests, production build, and the dependency audit gate in CI.
- Do not merge PR #23 into `main` automatically.

## Review Focus

- Production configuration with demo accounts disabled must expose no demo credentials.
- Legacy `/quick-access` must never mint a token.
- Stored vehicle capacity must clamp safely for malformed/over-limit values.
- Missing 3D model files must produce a truthful fallback state rather than a broken viewer.
- CI must prove the resulting branch still typechecks, tests, builds, and has no high-severity npm audit findings.

### Task 1: Authentication hardening

**Status:** VERIFIED

- `POST /api/auth/quick-access` returns HTTP 410 and cannot mint a token.
- Demo accounts are opt-in and are disabled in production.
- Production requires an explicit `JWT_SECRET` instead of using a predictable fallback.
- Regression coverage is included in the test suite.

### Task 2: Vehicle 3D asset truthfulness

**Status:** VERIFIED AS HONEST FALLBACK

- The asset registry requires a published GLB/GLTF asset before marking a model as official.
- `public/models/trucks/` currently contains documentation only; no GLB/GLTF files were invented or falsely registered.
- The UI continues to expose a reference/fallback asset when no official model exists.
- The existing vehicle asset integration suite verifies valid GLB publication, serving, fingerprinting, withdrawal, RBAC, and honest no-model behavior in a sandbox.

### Task 3: Dependency/security audit

**Status:** VERIFIED ON PRIOR CI RUN

- CI runs `npm audit --audit-level=high`.
- The audit identified four high-severity paths through Firebase → Firestore → `@grpc/grpc-js`.
- The project pins `@grpc/grpc-js` to the patched `^1.14.6` range through npm overrides.
- Prior CI run `40237060302` passed the dependency audit, typecheck, tests, and production build before the latest photo-first UI commits.

### Task 4: Photo-first interactive command center

**Status:** IMPLEMENTED — FRESH CI VERIFICATION PENDING

- The main command deck is now photo-first; the 3D viewer is not used as the primary command-center surface.
- Six indicators are interactive over the vehicle photo: speed, fuel, load, ETA, engine temperature, and remaining distance.
- The same indicators are available as an accessible button grid beside the photo.
- Fleet filters, vehicle selection, fleet summary metrics, tracking, and maintenance navigation remain available.
- The eight planned vehicle model slots remain `AWAITING_ASSET` until the real GLB/glTF files are supplied and verified.
- Current head: `1bbb53dd114bfe97fd536627178999f3fd3aaf89`.
- GitHub Actions has not yet produced a run for this exact head; Vercel status is currently affected by external build-rate limits.

### Task 5: 3D asset activation gate

**Status:** READY FOR REAL FILES

- When the eight real models are supplied, each file will be validated before activation.
- The model catalog already contains exactly eight planned slots.
- No placeholder 3D binary is treated as an official model.
- After upload, each model must pass format validation, registry publication, viewer loading, and CI verification before being marked `READY`.
