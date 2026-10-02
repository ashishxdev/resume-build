# Make My Resume — Project Status

Last updated: 2026-10-02

## Purpose

This document is the durable progress log for the Make My Resume project. It records major product, platform, and infrastructure milestones so the current state of the project can be understood without reconstructing it from commit history.

Update this file whenever a major feature is started, completed, materially redesigned, or intentionally deferred. Minor styling adjustments, routine refactors, and isolated bug fixes do not need separate milestone entries unless they change the status of a major feature.

## Current Snapshot

| Area | Status | Summary |
| --- | --- | --- |
| Project foundation | Complete | pnpm/Turborepo monorepo with web, API, shared contracts, resume engine, renderer, linting, TypeScript, and test foundations. |
| Marketing homepage | Complete | Responsive Stitch-inspired homepage implementing the Atelier Digital visual system and core product messaging. |
| Authentication | In progress | Email/password authentication now includes Resend-backed, rate-limited password recovery with single-use tokens and session revocation. Google OAuth still requires configuration and end-to-end verification. |
| Resume workflows | Not started | Import, verification, editing, tailoring, ATS analysis, versions, export, and sharing remain future milestones. |
| Backend business modules | Not started | The API health route and shared infrastructure exist; domain modules remain to be implemented. |

## Milestones

### 1. Project Scaffold

- **Date:** 2026-09-30
- **Status:** Complete
- **Commit:** `3da8524` (`chore: scaffold Make My Resume monorepo`)
- **Scope delivered:**
  - Created a pnpm workspace orchestrated with Turborepo.
  - Added the Next.js web application and Express API application.
  - Added shared packages for contracts, resume normalization, resume rendering, ESLint, and TypeScript configuration.
  - Established environment validation, structured logging, opaque entity IDs, health contracts, and baseline tests.
  - Added workspace scripts for building, type checking, linting, testing, and development.
- **Verification:** Scaffold tests, TypeScript boundaries, and workspace build foundations were established in the initial implementation.

### 2. Marketing Homepage

- **Date:** 2026-10-01
- **Status:** Complete
- **Scope delivered:**
  - Built the public homepage in `apps/web` using the connected Stitch design as the visual reference.
  - Applied the Atelier Digital visual language: Playfair Display, Plus Jakarta Sans, deep plum accents, editorial spacing, restrained surfaces, and low-contrast elevation.
  - Added the hero, interactive product preview, ethical-AI principles, resume comparison, job-match analysis, suggestion review, editor preview, ATS audit, versioning, workflow, pricing, FAQ, final CTA, and footer.
  - Added responsive desktop, tablet, and mobile layouts, including a stacked mobile product preview and corrected comparison flow.
  - Added semantic structure, reduced-motion support, page metadata, and a branded favicon.
  - Prepared homepage calls to action for the future `/login` and `/signup` routes.
- **Verification:** TypeScript and production builds pass. Desktop and mobile layouts were visually inspected, mobile horizontal overflow was checked, FAQ behavior was tested, and no browser console errors were observed.
- **Primary files:**
  - `apps/web/app/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/app/layout.tsx`
  - `apps/web/app/icon.svg`

### 3. Authentication and Protected Workspace

- **Date:** 2026-10-01
- **Status:** In progress
- **Scope delivered:**
  - Added Better Auth to the Express API with credentialed CORS, trusted-origin validation, secure cookie settings, and a protected current-user endpoint.
  - Added optional Better Auth Infrastructure dashboard integration when `BETTER_AUTH_API_KEY` is configured.
  - Added a development-safe in-memory auth store and a production-ready MongoDB adapter selected through environment configuration.
  - Added email/password sign-up, sign-in, session restoration, sign-out, password recovery, safe post-auth redirects, and optional Google OAuth when credentials are configured.
  - Built responsive Stitch-inspired sign-in and sign-up pages with clear loading, validation, and error states.
  - Added a protected dashboard shell that redirects signed-out visitors and provides the entry point for future resume workflows.
- **Verification:** Workspace type checking, linting, automated API tests, and the production build pass. The sign-up API, browser sign-in, protected dashboard, sign-out redirect, desktop layouts, and 390 px mobile layouts were verified with no horizontal overflow or browser console errors.
- **Deployment note:** Local development uses the in-memory adapter by default. Production persistence and Google OAuth require the MongoDB and Google credentials documented in `.env.example`. Better Auth Infrastructure is enabled only when its separate API key is supplied; the API key does not replace `BETTER_AUTH_SECRET`.
- **Remaining PRD scope:** Google OAuth is conditional on deployment credentials and has not been verified end to end, so the authentication milestone remains in progress.
- **Primary files:**
  - `apps/api/src/infrastructure/auth/auth.ts`
  - `apps/api/src/http/routes/auth.ts`
  - `apps/web/components/auth/auth-page.tsx`
  - `apps/web/app/login/page.tsx`
  - `apps/web/app/signup/page.tsx`
  - `apps/web/app/dashboard/page.tsx`

### 4. Authentication QA and Hardening

- **Date:** 2026-10-01
- **Status:** Complete with documented environment limitations
- **Scope delivered:**
  - Exercised signup, signin, logout, refresh, browser history, protected-route, invalid/expired-session, cookie, trusted-origin, MongoDB persistence, console, and network behavior in the local application.
  - Fixed stale post-authentication UI transitions, whitespace-only names, email normalization, a backslash-based open redirect, and response session-cookie logging.
  - Added regression coverage for normalized credentials, safe redirects, and request/response credential redaction.
  - Added the detailed test record in `docs/AUTHENTICATION_QA_REPORT.md`.
- **Verification:** 8 web tests and 8 API tests pass; web/API type checks and linters pass; the production workspace build passes. Chrome retests passed for affected UI flows, and MongoDB persistence was verified across an API restart.
- **Remaining limitations:** Google OAuth and production HTTPS cookie attributes require deployment credentials/environment testing; natural multi-day session renewal and a forced database outage were not exercised. The dashboard is a client-side protected shell, so all future private data endpoints must retain server-side authorization.
- **Primary files:**
  - `apps/web/components/auth/auth-page.tsx`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/lib/auth/email-credentials.ts`
  - `apps/web/lib/auth/safe-redirect.ts`
  - `apps/api/src/shared/logging/logger.ts`
  - `docs/AUTHENTICATION_QA_REPORT.md`

### 5. Security and Reliability Remediation

- **Date:** 2026-10-01
- **Status:** Complete in the repository; credential rotation remains an external action
- **Scope delivered:**
  - Removed the committed Stitch credential from tracked configuration and switched the MCP header to the local `STITCH_API_KEY` environment variable.
  - Required MongoDB-backed authentication storage in production.
  - Made root `.env.local` and `.env` loading consistent across the web app, API, and worker.
  - Added recoverable sign-out and Google sign-in error states.
  - Added functional Terms and Privacy pages and corrected homepage and authentication navigation.
  - Removed interactive semantics from homepage demonstration controls that do not perform actions.
  - Stopped tracking Next.js's generated `next-env.d.ts` file so builds no longer dirty the working tree.
- **External action:** The previously exposed Google API key must be revoked or rotated in Google Cloud. Repository history was purged separately so the old value is no longer present in the rewritten branch.

### 6. Transactional Email and Password Recovery

- **Date:** 2026-10-02
- **Status:** Complete
- **Scope delivered:**
  - Added a provider-neutral transactional email interface with a Resend implementation and validated production configuration.
  - Added a branded HTML and plain-text password-reset email with escaped user content and an optional reply-to address.
  - Added a neutral password-reset request flow that does not reveal whether an account exists.
  - Added one-hour, single-use reset tokens, rate limiting, expired-link recovery, password confirmation, and revocation of existing sessions after a successful reset.
  - Added spoof-resistant client-IP propagation from Express to Better Auth, with an explicit proxy allowlist for reliable per-client throttling behind production reverse proxies.
  - Added responsive `/forgot-password` and `/reset-password` pages and linked recovery from sign-in.
- **Verification:** 16 API tests and 8 web tests pass. Coverage includes template escaping, environment validation, account-enumeration resistance, rate limiting, trusted-proxy normalization, single-use tokens, old-password rejection, new-password sign-in, and session revocation. Workspace type checking, linting, formatting, and the production build pass. Desktop and 390 px mobile recovery states were visually verified. Resend accepted a provider-level delivery to its official test address using the configured development sender. A live API restart confirmed Better Auth resolves a client IP without its shared-bucket warning.
- **Remaining limitation:** Production delivery requires an address on a domain verified in Resend. Deployments behind a reverse proxy must set `TRUSTED_PROXY_IPS` to the proxy's exact IPs or CIDRs. Google OAuth also remains incomplete.
- **Primary files:**
  - `apps/api/src/infrastructure/email/email-service.ts`
  - `apps/api/src/infrastructure/auth/auth.ts`
  - `apps/web/components/auth/password-recovery-page.tsx`
  - `apps/web/app/forgot-password/page.tsx`
  - `apps/web/app/reset-password/page.tsx`

## Next Major Milestone

Configure and verify Google OAuth to finish the agreed authentication scope. Resume import and source verification inside the protected dashboard follows that work.

## Status Definitions

- **Not started:** No implementation work has begun.
- **In progress:** Active implementation exists but the feature is not ready for its intended use.
- **Blocked:** Progress depends on a decision, external system, credential, or unresolved technical constraint.
- **Complete:** The agreed scope is implemented and verified in proportion to its risk.
- **Deferred:** The feature was intentionally moved out of the current delivery scope.
