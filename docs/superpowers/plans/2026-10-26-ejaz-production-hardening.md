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

**Status:** IMPLEMENTED

- `POST /api/auth/quick-access` now returns HTTP 410 and cannot mint a token.
- Demo accounts are opt-in and are disabled in production.
- Production now requires an explicit `JWT_SECRET` instead of using a predictable fallback.
- Regression tests cover the production configuration policy.

### Task 2: Vehicle 3D asset truthfulness

**Status:** VERIFIED AS HONEST FALLBACK

- The asset registry already requires published GLB/GLTF assets before marking a model as official.
- `public/models/trucks/` currently contains only documentation and no GLB/GLTF files.
- The UI therefore continues to expose a reference/fallback asset rather than pretending a 3D model exists.
- The existing vehicle asset integration test creates a minimal valid GLB in a sandbox and verifies publication, serving, fingerprinting, withdrawal, and RBAC.

### Task 3: Dependency/security audit

**Status:** GATE ADDED; FINAL RUN REQUIRED AFTER WORKFLOW COMMIT

- CI now includes `npm audit --audit-level=high`.
- No forced dependency upgrade was applied because the current install/test/build run had no evidence requiring one.
- A fresh CI run after the workflow commit is required to record the audit result for the current head.

### Task 4: Production verification

**Status:** IN PROGRESS

- The latest completed CI run before the audit-gate commit passed TypeScript, tests, and production build.
- The latest workflow commit adds the audit gate; the next PR synchronization run must verify that gate alongside the existing checks.
- PR #23 remains open and unmerged.
- Vercel deployment is externally rate-limited by the free daily deployment quota; this is separate from source/build correctness.
