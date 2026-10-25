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
- All changes must pass TypeScript, tests, and production build in CI.
- Do not merge PR #23 into `main` automatically.

## Review Focus

- Production configuration with demo accounts disabled must expose no demo credentials.
- Legacy `/quick-access` must never mint a token.
- Stored vehicle capacity must clamp safely for malformed/over-limit values.
- Missing 3D model files must produce a truthful fallback state rather than a broken viewer.
- CI must prove the resulting branch still typechecks, tests, and builds.

### Task 1: Authentication hardening

**Files:**
- Modify: `src/server/routes/authRoutes.ts`
- Test: existing authentication test harness under `tests/`

**Interfaces:**
- `/api/auth/login` remains the only credential-based session creation route.
- `/api/auth/quick-access` remains disabled with HTTP 410.
- `/api/auth/demo-accounts` returns no accounts when demo mode is disabled.

- [ ] Verify existing tests cover quick-access rejection and production demo mode.
- [ ] Add/adjust regression coverage for the disabled quick-access route and disabled demo-account disclosure.
- [ ] Run the focused tests and confirm the expected red/green cycle before implementation changes.
- [ ] Keep demo credentials behind explicit `ENABLE_DEMO_ACCOUNTS` test configuration.
- [ ] Run the full test suite.
- [ ] Commit the task.

### Task 2: Vehicle 3D asset truthfulness

**Files:**
- Inspect/modify: `src/data/vehicleAssetRegistry*`, `src/components/Vehicle3DViewer*`, `src/components/ARTruckExperience*`, `public/models/trucks/`
- Test: existing fleet imagery/asset verification scripts and relevant tests

**Interfaces:**
- Asset registry returns a real local/verified model URL only when the file exists.
- Missing/unverified assets render the existing fallback/reference experience without pretending the model is official.

- [ ] Inspect current registry and viewer resolution paths.
- [ ] Add tests for missing-model and valid-model resolution.
- [ ] Run the asset verification test before implementation changes.
- [ ] Implement only evidence-backed asset resolution; do not invent model URLs.
- [ ] Run asset verification and full tests.
- [ ] Commit the task.

### Task 3: Dependency/security audit

**Files:**
- Modify only if required: `package.json`, lockfile, affected source files.
- Add: focused security verification script/workflow if the existing CI does not provide one.

**Interfaces:**
- No forced major dependency upgrades.
- Vulnerability remediation must be tied to an actual advisory and regression-tested.

- [ ] Inspect the current dependency tree and lockfile through CI-supported commands.
- [ ] Identify the four high-severity advisories reported during dependency installation.
- [ ] Patch only affected dependencies when safe and compatible.
- [ ] Run tests and production build after any dependency change.
- [ ] Commit the task.

### Task 4: Production verification

**Files:**
- Modify: CI configuration only if a missing verification gate is identified.

- [ ] Run TypeScript verification.
- [ ] Run all tests.
- [ ] Run production build.
- [ ] Run fleet imagery verification.
- [ ] Confirm no passwordless route remains capable of minting sessions.
- [ ] Confirm PR #23 contains the intended changes and remains unmerged.
- [ ] Record any remaining external blocker, such as Vercel deployment quota, separately from code correctness.
