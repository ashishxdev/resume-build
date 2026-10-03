# Make My Resume — Project Status

Last updated: 2026-10-03

## Purpose

This document is the durable progress log for the Make My Resume project. It records major product, platform, and infrastructure milestones so the current state of the project can be understood without reconstructing it from commit history.

Update this file whenever a major feature is started, completed, materially redesigned, or intentionally deferred. Minor styling adjustments, routine refactors, and isolated bug fixes do not need separate milestone entries unless they change the status of a major feature.

## Current Snapshot

| Area | Status | Summary |
| --- | --- | --- |
| Project foundation | Complete | pnpm/Turborepo monorepo with web, API, shared contracts, resume engine, renderer, linting, TypeScript, and test foundations. |
| Marketing homepage | Complete | Responsive Stitch-inspired homepage implementing the Atelier Digital visual system and core product messaging. |
| Authentication | In progress | Email/password authentication now includes Resend-backed, rate-limited password recovery with single-use tokens and session revocation. Google OAuth still requires configuration and end-to-end verification. |
| Dashboard workspace | Complete | Responsive authenticated dashboard implements the approved desktop and mobile Stitch designs with truthful empty, loading, navigation, account, plan, activity, and trust states. |
| Resume workflows | In progress | PDF/DOCX import, Gemini-assisted structured extraction, source-backed review, verified base versions, and grounded job-match analysis are complete. Suggestion review, tailored versions, ATS analysis, export, and sharing remain future milestones. |
| Backend business modules | In progress | Owned imports, private R2 originals, extraction jobs, provider-neutral grounded AI parsing, verified base-version persistence, and owned job-description analysis are complete. Tailored-version generation remains future work. |

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
  - Added one-hour, single-use reset tokens, rate limiting, pre-submission token validation via a request body that stays out of URL logs, expired-link recovery, password confirmation, and revocation of existing sessions after a successful reset.
  - Added spoof-resistant client-IP propagation from Express to Better Auth, with an explicit proxy allowlist for reliable per-client throttling behind production reverse proxies.
  - Added responsive `/forgot-password` and `/reset-password` pages and linked recovery from sign-in.
- **Verification:** 17 API tests and 14 web tests pass. Coverage includes template escaping, environment validation, account-enumeration resistance, rate limiting, reset-token pre-validation, URL-log safety, checking/unavailable/invalid client states, retryable reset failures, trusted-proxy normalization, single-use tokens, old-password rejection, new-password sign-in, and session revocation. Workspace type checking, linting, formatting, and the production build pass. Desktop and 390 px mobile recovery states were visually verified. Resend accepted a provider-level delivery to its official test address using the configured development sender. A live API restart confirmed Better Auth resolves a client IP without its shared-bucket warning.
- **Remaining limitation:** Production delivery requires an address on a domain verified in Resend. Deployments behind a reverse proxy must set `TRUSTED_PROXY_IPS` to the proxy's exact IPs or CIDRs. Google OAuth also remains incomplete.
- **Primary files:**
  - `apps/api/src/infrastructure/email/email-service.ts`
  - `apps/api/src/infrastructure/auth/auth.ts`
  - `apps/web/components/auth/password-recovery-page.tsx`
  - `apps/web/app/forgot-password/page.tsx`
  - `apps/web/app/reset-password/page.tsx`

### 7. Authenticated Dashboard Workspace

- **Date:** 2026-10-02
- **Status:** Complete
- **Scope delivered:**
  - Rebuilt the protected dashboard from the approved Stitch desktop and mobile references using the Atelier Digital visual system.
  - Added a responsive top navigation, mobile bottom navigation, plan and usage summary, authenticated account menu, recoverable sign-out feedback, resume-library empty state, recent-activity empty state, and zero-hallucination trust panel.
  - Added explicit feedback for the notification and plan-upgrade controls so every interactive element communicates its current state.
  - Kept dashboard content truthful to the current product state: resume and tailored-draft counts are zero until the resume APIs exist, while upload and create actions explain their upcoming milestone instead of behaving like silent mock controls.
  - Preserved session restoration and signed-out redirection to the login flow.
- **Verification:** 20 web tests pass across 5 files, including authenticated empty-state rendering, signed-out redirection, staged-feature feedback, hydration with different server/client time bands, homepage-anchor validity, and the zero-unread notification state. Web type checking, linting, Prettier validation, and the Next.js production build pass. The dashboard was visually verified at desktop and 390 × 844 mobile widths; the mobile page has no horizontal overflow. Live browser passes confirmed notification and upgrade feedback, account-menu sign-out, session rejection after sign-out, the protected dashboard redirect, hydration-localized greeting, `/#integrity` destinations, and the absence of an unread pseudo-element at zero notifications. Automatic font preloads were disabled after Chrome reported that the route did not consume them quickly enough; the clean follow-up browser sessions reported no application warnings or errors. Disposable QA accounts and their sessions were removed after testing.
- **Remaining work:** Resume statistics and activity must be connected to owned API resources when the resume import module is implemented. Upload, create, resume search, and populated resume cards belong to the next milestones.
- **Primary files:**
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/dashboard/dashboard.module.css`
  - `apps/web/app/dashboard/page.test.tsx`

### 8. Resume Upload and Import Foundation

- **Date:** 2026-10-02
- **Status:** Complete
- **Scope delivered:**
  - Added authenticated, user-owned resume, file, and import records with memory and MongoDB repository implementations.
  - Added 15-minute, content-type-bound signed PUT URLs so original files upload directly from the browser to private Cloudflare R2 storage without passing through the API process.
  - Added server-side size, reported-content-type, and file-signature checks before an import is accepted; invalid objects are rejected and removed.
  - Bound the validated byte length into each signed PUT request so R2 rejects oversized, undersized, or otherwise length-mismatched uploads before accepting them.
  - Added PDF, DOCX, JPEG, PNG, and WEBP support with a 10 MB limit, idempotent completion, cancellation, and ownership enforcement.
  - Replaced the staged dashboard upload control with a responsive drag-and-drop/file-picker workflow with upload progress, verification, success, retry, cancellation, and actionable failure states.
  - Made verification terminal transitions compare-and-set from `verifying`, preventing concurrent cancellation from being overwritten, and made every unfinished dialog dismissal attempt server-side cancellation before closing.
  - Connected the dashboard summary, resume library, and recent activity to the authenticated resume API.
- **Verification:** 31 API tests and 27 web tests pass. Workspace type checking, linting, Prettier validation, and the production build pass. Regression coverage includes cancellation racing both successful and failed verification, signed content-length propagation, cleanup on failed-dialog dismissal, and keeping the dialog open when cleanup cannot be confirmed. A live R2 size-enforcement check accepted an exact five-byte PUT with HTTP 200 and rejected a six-byte PUT using the same five-byte signed URL with HTTP 403; the temporary object was removed. A prior live browser pass verified the complete direct-upload, API verification, success, and dashboard-refresh flow at desktop and 390 × 844 mobile sizes without console warnings or errors. All disposable QA data was removed afterward.
- **Important limitation:** Resume content extraction and user verification belong to the following milestone. DOCX validation currently confirms the ZIP container signature; full Office-package validation will happen with extraction. Google OAuth remains deferred until deployment credentials are ready.
- **Scope superseded in milestone 9:** Image import support was removed before extraction shipped. The supported input set is now deliberately limited to PDF and DOCX.
- **Primary files:**
  - `apps/api/src/http/routes/resume-imports.ts`
  - `apps/api/src/infrastructure/storage/r2-object-storage.ts`
  - `apps/api/src/modules/resumes/resume-import-repository.ts`
  - `apps/web/components/dashboard/resume-upload-dialog.tsx`
  - `apps/web/lib/resume/import-client.ts`
  - `packages/contracts/src/resume/import.ts`

### 9. Resume Extraction and Evidence Verification

- **Date:** 2026-10-02; AI parsing extension completed 2026-10-03
- **Status:** Complete
- **Scope delivered:**
  - Restrict resume imports to PDF and DOCX documents; image and OCR-based imports are intentionally deferred.
  - Added worker-safe, atomically claimed, retryable extraction jobs backed by memory or MongoDB persistence, with private originals read directly from Cloudflare R2.
  - Added PDF.js and Mammoth extraction with bounded document text, PDF page provenance, deterministic section classification, and explicit failure states for unreadable documents.
  - Added authenticated, ownership-enforced verification APIs that preserve server-owned source provenance and establish a persisted base version only after every retained claim is reviewed.
  - Added a responsive evidence-review workspace where users can confirm, edit, reject, add, remove, recategorize, and reorder extracted details, save partial progress, retry failed extraction, and return later from the dashboard.
  - Connected dashboard cards to queued, processing, review-required, failed, and verified extraction states.
  - Hardened post-QA behavior by restarting status polling after a failed extraction is retried, joining fragmented PDF text with coordinate-aware word gaps, and aligning homepage format messaging with the implemented workflow.
  - Added a derived `unsupported_legacy_format` compatibility state for image imports created before the PDF/DOCX-only decision, with a clear replacement path and protection against accidentally enqueueing those records for extraction.
  - Added a provider-neutral AI parsing boundary with a Gemini implementation that groups one summary, logical role-level experience entries, qualifications, projects, certifications, achievements, and consolidated skills instead of emitting one claim per source line.
  - Required every AI claim to carry an exact quote from its declared source page. Ungrounded, malformed, empty, oversized, or unavailable AI responses automatically fall back to deterministic parsing without failing the extraction job.
  - Disabled provider-side interaction storage, bounded AI input and output, kept credentials and résumé content out of application logs, and retained mandatory user review before a verified base version can be created.
  - Hardened MongoDB job processing with expiring owner-token leases, safe stale-job reclamation, stale-worker write rejection, and a terminal failure after repeated abandoned attempts.
  - Made extraction-job creation an atomic upsert protected by a unique `resumeId` index, preventing concurrent import completion from creating duplicate jobs.
  - Made verification, base-version persistence, and the resume baseline pointer one MongoDB transaction guarded by an optimistic record revision. Failed writes roll back the entire transition, while competing saves return a state conflict.
  - Assigned DOCX extraction a stable synthetic document page identifier so Gemini claims can use the same exact-quote grounding path as PDF claims.
- **Verification:** 52 API tests and 30 web tests pass. Workspace type checking, linting, Prettier validation, and production builds pass. Regression coverage includes image-format rejection, legacy-image compatibility, idempotent extraction-job creation, lease expiry and reclamation, stale-worker rejection, abandoned-attempt exhaustion, optimistic concurrent-save rejection, cross-account isolation, immutable provenance, verified-version creation, coordinate-aware PDF word reconstruction, synthetic DOCX provenance, deterministic section classification, grounded Gemini response validation for PDF and DOCX, duplicate and multiple-summary filtering, provider-failure fallback, review UI transitions, retry polling through a second terminal failure, and retry feedback. An isolated live MongoDB check in a disposable database passed concurrent unique upsert, expired-lease reclamation, transactional version and pointer consistency, and full rollback under a forced version-write failure; the database was dropped afterward. A live Gemini smoke test using synthetic résumé content and the configured `gemini-3.8-flash` model returned one personal-information claim, one summary, one role-level experience claim, and one consolidated skills claim with valid page evidence. A generated DOCX smoke document also passed the production extraction path. Manual QA previously passed DOCX and PDF upload/extraction, partial review persistence, verified-version creation, mobile layouts, and dashboard state transitions.
- **Important limitations:** AI parsing requires configured Gemini credentials; when it is disabled, rate-limited, unavailable, malformed, or ungrounded, extraction deliberately falls back to the less precise deterministic parser. Text extracted from a résumé is transmitted to the configured Gemini service for parsing, with interaction storage disabled. User review remains mandatory. Scanned/image-only PDFs are reported as unreadable because OCR and all image uploads are deferred, and complex multi-column documents still depend on PDF text-extraction quality.
- **Primary files:**
  - `apps/api/src/modules/resumes/document-text-extractor.ts`
  - `apps/api/src/infrastructure/ai/gemini-resume-parser.ts`
  - `apps/api/src/modules/resumes/resume-ai-parser.ts`
  - `apps/api/src/modules/resumes/resume-extraction-repository.ts`
  - `apps/api/src/modules/resumes/resume-extraction-service.ts`
  - `apps/api/src/http/routes/resume-verification.ts`
  - `apps/web/components/resume/resume-verification-page.tsx`
  - `apps/web/app/resumes/[resumeId]/verify/page.tsx`
  - `packages/contracts/src/resume/verification.ts`

### 10. Job Description Analysis and Evidence Match

- **Date:** 2026-10-03
- **Status:** Complete
- **Scope delivered:**
  - Capture a target role, company, and full job description against an owned verified résumé baseline.
  - Analyze requirements through a provider-neutral Gemini integration while treating job text as untrusted data and preserving exact source quotes.
  - Compare every grounded requirement with verified résumé claims and distinguish strong, partial, and missing or unverified evidence without modifying the base résumé.
  - Implement the approved Stitch desktop and mobile designs for job-description input, analysis progress, and the evidence-match overview.
  - Persist the raw job description as source of truth with provider/model/prompt metadata, optimistic analysis transitions, owner-only access, verified-version binding, and a retry path that preserves the saved input.
  - Persist an immutable evidence-claim snapshot with every analysis so historical scores and evidence text remain bound to the exact verified resume version even after the baseline changes.
  - Move Gemini work out of the HTTP request lifecycle: create and retry return `202` with a durable queued record, a lease-owning worker processes it, expired leases are reclaimed after worker interruption, and the results view polls through queued and analyzing states.
  - Limit expensive AI entry points to ten requests per user per hour with a MongoDB-backed atomic bucket and `Retry-After` response, while a partial unique index permits only one queued or processing analysis per user at a time.
  - Connect verified dashboard resume cards to the workflow and keep the next suggestion-generation action explicitly staged instead of presenting a dead control.
- **Verification:** 66 API tests and 33 web tests pass, including exact-quote grounding, unknown-claim downgrades, provider privacy (`store: false`), immutable evidence snapshots, optimistic and lease-owned repository transitions, stale-worker reclamation, per-user hourly quotas, concurrent-analysis rejection, immediate queued responses, status polling, verified-resume gating, cross-user isolation, legacy-record snapshot hydration, retry-without-duplicate behavior, match filtering, and historical evidence rendering. Workspace type checking, linting, Prettier validation, and the production build pass. A disposable live MongoDB smoke test passed the partial unique concurrency index, expired-lease reclamation with a new processing token, immutable evidence persistence, and the atomic hourly quota; the test database was dropped afterward. The job-input, analyzing, failure, and match-overview states were exercised in the live app. Desktop and 390 × 844 mobile layouts were visually inspected; both mobile routes had `scrollWidth === clientWidth`, and the browser reported no application warnings or errors. A live Gemini attempt exercised the saved failure state when `gemini-3.8-flash` returned HTTP 503 for temporary high demand; `gemini-3.1-flash-lite` then completed the same grounded synthetic analysis and is now the development/default model.
- **Important limitations:** Gemini availability and latency remain external dependencies; failed analyses retain their input and can be retried. The built-in quota is ten analysis attempts per user per hour and intentionally permits only one active analysis per user. Match scoring is an evidence-coverage indicator, not an ATS prediction. Suggestion generation, individual accept/reject decisions, and tailored-version persistence belong to the next milestone.
- **Primary files:**
  - `apps/api/src/infrastructure/ai/gemini-job-description-analyzer.ts`
  - `apps/api/src/modules/job-descriptions/job-description-repository.ts`
  - `apps/api/src/modules/job-descriptions/job-analysis-rate-limiter.ts`
  - `apps/api/src/modules/job-descriptions/job-description-analysis-loop.ts`
  - `apps/api/src/http/routes/job-descriptions.ts`
  - `apps/web/components/tailoring/job-description-workflow.tsx`
  - `apps/web/components/tailoring/match-overview.tsx`
  - `packages/contracts/src/job-description/analysis.ts`

## Next Major Milestone

Evidence-backed tailoring suggestions are next: generate conservative edits from the completed match analysis, require an explicit accept or reject decision for every suggestion, and persist a new tailored resume version without changing the verified base.

## Status Definitions

- **Not started:** No implementation work has begun.
- **In progress:** Active implementation exists but the feature is not ready for its intended use.
- **Blocked:** Progress depends on a decision, external system, credential, or unresolved technical constraint.
- **Complete:** The agreed scope is implemented and verified in proportion to its risk.
- **Deferred:** The feature was intentionally moved out of the current delivery scope.
