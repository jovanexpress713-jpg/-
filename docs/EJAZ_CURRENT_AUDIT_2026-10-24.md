# EJAZ Transport — Current Repository Audit
**Audit date:** 2026-10-24  
**Repository:** https://github.com/jovanexpress713-jpg/-  
**Branch audited:** `main` at commit `3b3fc4a3072bd35c03cf472b025bde244d1fecb6`

## Scope and evidence
This review inspected the GitHub repository tree, package scripts, Express route registration, authentication routes, JWT configuration, database adapter, PostgreSQL schema file, Firestore rules, test sources, and prior audit documents. This is a source review; it is **not** a claim that the current production deployment or all tests were executed in this environment.

## Confirmed findings

### Critical — passwordless administrator quick access
`src/server/routes/authRoutes.ts` registers `POST /api/auth/quick-access`. The handler selects a user by requested role/email and issues a signed JWT without checking a password. The route is mounted under `/api/auth` by `src/server/app.ts`. Before this patch, the handler had no production-mode guard.

**Patch in this branch:** quick access returns 404 when `NODE_ENV=production` or demo accounts are not explicitly enabled. Demo accounts are now opt-in in non-production environments only.

### High — known fallback JWT signing secret
Before this patch, `src/server/config.ts` supplied a predictable JWT secret when `JWT_SECRET` was absent. Any production deployment using that default could be vulnerable to token forgery.

**Patch in this branch:** production receives no fallback signing secret; `server.ts` refuses to start in production unless `JWT_SECRET` is at least 32 characters. This is a length gate, not a substitute for generating and storing a cryptographically random secret.

### Critical production-readiness blocker — operational data is process-local
`src/server/db/index.ts` explicitly documents that current API entity CRUD uses process-local in-memory Maps. The file seeds demo users, drivers, customers, vehicles, trips and financial data in memory. A PostgreSQL pool/connectivity probe does not make those Maps persistent. Data can disappear on restart and will not reliably synchronize across multiple server instances.

**Not repaired in this patch:** replacing this adapter requires migrating every repository operation to persistent PostgreSQL transactions, schema constraints, concurrency-safe trip numbering, and financial ledger integrity. Simply setting `DATABASE_URL` is not sufficient, so this report does not label the database production-ready.

### High — deployment and reproducible verification gap
The default branch tree has no `.github/workflows/` CI workflow and no package lockfile. Dependencies use a mix of pinned and range-based versions. The branch adds a CI workflow that installs dependencies and runs the existing test suite, TypeScript check, and production build. The workflow must actually run green before those checks can be called passed.

### High — financial subsystem requires accounting acceptance tests
The project contains finance service/routes and tests, but source presence alone does not prove a production-grade double-entry general ledger. Before sale, verify immutable journal entries, balanced debits/credits, period close, reversal rather than destructive edits, payment allocation, tax/currency rounding, idempotency, and atomic settlement transactions against a persistent database.

### Medium — live integrations are not verified by source review
GPS provider, Google Maps, Gemini, document uploads and notifications require real provider credentials and deployment configuration. Simulated GPS or seeded values must be visibly labelled as demo data and must not be presented as live telemetry.

## Checks in the new CI workflow
- `npm test`
- `npm run lint`
- `npm run build`

**Status at report creation:** not run here. Check the GitHub Actions run attached to the pull request before considering them passed.

## Release gate
Do not sell or describe the current repository as production-ready until the persistent database migration, production identity provisioning (no seeded/demo accounts), financial ledger controls, backup/restore drill, provider integrations, deployment secrets, and independent security/acceptance tests are complete.
