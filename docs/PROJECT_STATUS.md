# Make My Resume — Project Status

Last updated: 2026-10-08

## Purpose

This document is the durable progress log for the Make My Resume project. It records major product, platform, and infrastructure milestones so the current state of the project can be understood without reconstructing it from commit history.

Update this file whenever a major feature is started, completed, materially redesigned, or intentionally deferred. Minor styling adjustments, routine refactors, and isolated bug fixes do not need separate milestone entries unless they change the status of a major feature.

## Current Snapshot

| Area | Status | Summary |
| --- | --- | --- |
| Project foundation | Complete | pnpm/Turborepo monorepo with web, API, shared contracts, resume engine, renderer, linting, TypeScript, and test foundations. |
| Marketing homepage | Complete | Responsive Stitch-inspired homepage implementing the Atelier Digital visual system and core product messaging. |
| Authentication | In progress | Email/password authentication now includes Resend-backed, rate-limited password recovery with single-use tokens and session revocation. Google OAuth still requires configuration and end-to-end verification. |
| Dashboard workspace | Complete | Responsive authenticated dashboard implements the approved desktop and mobile Stitch designs with truthful empty, loading, navigation, activity, resume management, tailored-draft management, trust states, and dedicated resume/activity routes. |
| Resume workflows | In progress | PDF/DOCX import, Gemini-assisted extraction, verified base versions, grounded job matching, evidence-backed suggestion review, immutable tailored versions, transparent ATS compatibility analysis and improvement actions, Professional ATS PDF/DOCX export, and permanent owned-resume deletion are complete. Additional templates and sharing remain future milestones. |
| Backend business modules | In progress | Owned imports, private R2 originals, recoverable queues, grounded parsing and matching, explicit suggestion decisions, transactional tailored-version persistence, ATS analysis and improvement workflows, saved ATS snapshots, and authenticated deterministic document export are complete. |

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
  - Added the hero, interactive product preview, ethical-AI principles, resume comparison, job-match analysis, suggestion review, editor preview, ATS audit, versioning, workflow, FAQ, final CTA, and footer.
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
  - Added a responsive top navigation, mobile bottom navigation, product-usage summary, authenticated account menu, recoverable sign-out feedback, resume-library empty state, recent-activity empty state, and zero-hallucination trust panel.
  - Added explicit feedback for the notification control so every interactive element communicates its current state.
  - Kept dashboard content truthful to the current product state: resume and tailored-draft counts are zero until the resume APIs exist, while upload and create actions explain their upcoming milestone instead of behaving like silent mock controls.
  - Preserved session restoration and signed-out redirection to the login flow.
- **Verification:** 20 web tests pass across 5 files, including authenticated empty-state rendering, signed-out redirection, staged-feature feedback, hydration with different server/client time bands, homepage-anchor validity, and the zero-unread notification state. Web type checking, linting, Prettier validation, and the Next.js production build pass. The dashboard was visually verified at desktop and 390 × 844 mobile widths; the mobile page has no horizontal overflow. Live browser passes confirmed notification feedback, account-menu sign-out, session rejection after sign-out, the protected dashboard redirect, hydration-localized greeting, `/#integrity` destinations, and the absence of an unread pseudo-element at zero notifications. Automatic font preloads were disabled after Chrome reported that the route did not consume them quickly enough; the clean follow-up browser sessions reported no application warnings or errors. Disposable QA accounts and their sessions were removed after testing.
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
  - Connect verified dashboard resume cards to the workflow and its evidence-backed tailoring continuation.
- **Verification:** 66 API tests and 33 web tests pass, including exact-quote grounding, unknown-claim downgrades, provider privacy (`store: false`), immutable evidence snapshots, optimistic and lease-owned repository transitions, stale-worker reclamation, per-user hourly quotas, concurrent-analysis rejection, immediate queued responses, status polling, verified-resume gating, cross-user isolation, legacy-record snapshot hydration, retry-without-duplicate behavior, match filtering, and historical evidence rendering. Workspace type checking, linting, Prettier validation, and the production build pass. A disposable live MongoDB smoke test passed the partial unique concurrency index, expired-lease reclamation with a new processing token, immutable evidence persistence, and the atomic hourly quota; the test database was dropped afterward. The job-input, analyzing, failure, and match-overview states were exercised in the live app. Desktop and 390 × 844 mobile layouts were visually inspected; both mobile routes had `scrollWidth === clientWidth`, and the browser reported no application warnings or errors. A live Gemini attempt exercised the saved failure state when `gemini-3.8-flash` returned HTTP 503 for temporary high demand; `gemini-3.1-flash-lite` then completed the same grounded synthetic analysis and is now the development/default model.
- **Important limitations:** Gemini availability and latency remain external dependencies; failed analyses retain their input and can be retried. The built-in quota is ten AI attempts per user per hour and intentionally permits only one active analysis per user. Match scoring is an evidence-coverage indicator, not an ATS prediction.
- **Primary files:**
  - `apps/api/src/infrastructure/ai/gemini-job-description-analyzer.ts`
  - `apps/api/src/modules/job-descriptions/job-description-repository.ts`
  - `apps/api/src/modules/job-descriptions/job-analysis-rate-limiter.ts`
  - `apps/api/src/modules/job-descriptions/job-description-analysis-loop.ts`
  - `apps/api/src/http/routes/job-descriptions.ts`
  - `apps/web/components/tailoring/job-description-workflow.tsx`
  - `apps/web/components/tailoring/match-overview.tsx`
  - `packages/contracts/src/job-description/analysis.ts`

### 11. Evidence-Backed Tailoring Suggestions and Versions

- **Date:** 2026-10-03
- **Status:** Complete
- **Scope delivered:**
  - Fetch and implement the approved Stitch desktop and mobile generation, suggestion-review, and completed-version screens in the existing Atelier Digital design system.
  - Generate conservative Gemini wording suggestions only for verified claims connected to strong or partial job matches, with interaction storage disabled and every suggestion bound to source claim and requirement IDs.
  - Reject unlinked output, duplicate claim edits, unchanged text, and newly introduced numeric facts before AI output can reach the user.
  - Run generation through a durable queued workflow with processing leases, stale-worker reclamation, bounded retries, owner-only access, one active generation per user, shared hourly AI quotas, saved failure states, and explicit retry handling.
  - Require an explicit accept or reject decision for every suggestion, support accept-all, reject-all, and editable accepted wording, and persist each decision optimistically so refreshes preserve progress.
  - Create a separate immutable tailored resume version only after all decisions are complete. The version records its base version, job analysis, tailoring session, and final claims without changing the verified base pointer.
  - Surface completed and in-progress tailoring sessions on the dashboard, update workflow counts, and allow users to reopen saved work.
- **Verification:** 71 API tests and 39 web tests pass. Coverage includes evidence and requirement binding, invented-number rejection for both provider output and manual edits, queue processing, owner isolation, quota-safe idempotent session reopening, transient polling recovery, pending-decision enforcement, optimistic decision persistence, preservation of manually edited accepted wording, separate tailored-version creation, workflow navigation, truthful dashboard counts, independent resume and tailoring failure states, reopen links, and disabled completion until every decision is made. Workspace type checking, linting, Prettier validation, and the production build pass. A disposable live MongoDB smoke test passed queue claiming, persisted decisions, transactional tailored-version creation, and base-version preservation; the test database was dropped afterward. A live `gemini-3.1-flash-lite` smoke test returned one grounded suggestion for synthetic evidence with the expected source-claim binding. The responsive implementation follows the six approved Stitch desktop/mobile screens; authenticated live visual inspection remains part of final user acceptance.
- **Important limitations:** Gemini availability and latency remain external dependencies; failed sessions can be retried without losing their bound analysis. The lexical safety layer rejects new numeric facts while the provider prompt and evidence links constrain other factual wording; user review remains mandatory. ATS improvement actions, additional export templates, sharing, and manual editing outside suggested claims remain future milestones.
- **Primary files:**
  - `apps/api/src/infrastructure/ai/gemini-tailoring-generator.ts`
  - `apps/api/src/modules/tailoring/tailoring-repository.ts`
  - `apps/api/src/modules/tailoring/tailoring-service.ts`
  - `apps/api/src/http/routes/tailoring.ts`
  - `apps/web/components/tailoring/tailoring-session-page.tsx`
  - `apps/web/components/tailoring/tailoring.module.css`
  - `packages/contracts/src/tailoring/session.ts`

### 12. Transparent ATS Compatibility Analysis

- **Date:** 2026-10-03
- **Status:** Complete
- **Scope delivered:**
  - Analyze the immutable tailored version against its bound job analysis and verified evidence without claiming to reproduce an employer's proprietary ATS.
  - Save a version-bound snapshot with an overall compatibility indicator and six explainable category scores: keyword coverage, skill alignment, experience relevance, section completeness, structure/readability, and formatting compatibility.
  - Separate findings into strengths, evidence-safe improvement opportunities, and genuinely missing requirements that the product will not invent.
  - Match keyword coverage using normalized whole tokens instead of substrings, with explicit canonical handling for C#, C++, and .NET, so terms such as Java/JavaScript and SQL/NoSQL do not produce false positives.
  - Present strong, moderate, or weak alignment language from the actual compatibility score instead of showing an unconditional positive headline.
  - Run analysis through a durable queue with processing leases, stale-work reclamation, bounded attempts, saved failure states, owner-only access, retry handling, and idempotent reopen behavior.
  - Add responsive loading, failure, and results experiences linked directly from the completed tailored version.
- **Verification:** 76 API tests, 42 web tests, and 4 resume-engine tests pass. Coverage includes version binding, six-category output, unsupported-requirement handling, ownership, queued route behavior, transparent results rendering, exact-token protection for Java/JavaScript and SQL/NoSQL, special-token handling for C#/C++/.NET, and all three alignment-headline score bands. Workspace type checking, linting, Prettier validation, and production builds pass.
- **Important limitations:** This is an internal compatibility methodology, not a prediction of a specific employer's ATS score. Professional ATS document rendering and layout validation are now delivered by milestone 13. Applying ATS improvements remains the next increment.
- **Primary files:**
  - `apps/api/src/modules/tailoring/ats-analysis-service.ts`
  - `apps/api/src/modules/tailoring/ats-analysis-loop.ts`
  - `apps/api/src/modules/tailoring/tailoring-repository.ts`
  - `apps/api/src/http/routes/tailoring.ts`
  - `apps/web/components/tailoring/ats-analysis-page.tsx`
  - `packages/contracts/src/ats/analysis.ts`

### 13. Professional ATS Resume Preview and Export

- **Date:** 2026-10-04
- **Status:** Complete
- **Scope delivered:**
  - Added a canonical professional-resume document model that deterministically transforms the immutable tailored claim set into identity, contact, and ordered resume sections without introducing new facts.
  - Added one polished, single-column Professional ATS template shared by the responsive browser preview, searchable PDF renderer, and editable DOCX renderer.
  - Added comfortable and compact spacing modes for normal and content-heavy resumes while keeping the original uploaded file and verified base version unchanged.
  - Added an authenticated export studio linked from completed tailoring sessions, with explicit original-protection messaging and private, no-store PDF and DOCX download responses.
  - Bound every export to the completed tailored version and preserved accepted wording, section order, contact details, and source-derived headings across both file formats.
  - Preserve source PDF contact and project hyperlink destinations in regenerated PDF output, restore the PDF cursor after manually positioned contact rows, and normalize grouped skills, projects, experience, and education into readable resume lines without repeating headings.
- **Verification:** 76 API tests, 42 web tests, and 4 resume-engine tests pass. Coverage includes canonical document construction, rejected-claim omission, contact parsing, searchable PDF text, editable DOCX text, authenticated ownership, private cache headers, output filenames, preview rendering, layout-density selection, both download actions, and compile-safe pdf.js text-item narrowing. Workspace type checking, linting, Prettier validation, and production builds pass. Representative one-page and two-page PDF and DOCX files were previously rendered to PNG and visually inspected at full-page resolution; both formats had clean typography, intact headings, correct Letter sizing, readable contact information, stable page breaks, and no clipping, overlap, or missing glyphs. The subsequent hyperlink and grouped-content corrections have automated and compile verification but still require a fresh visual PDF inspection.
- **Important limitations:** The first release includes one template and two density settings. Browser preview and exported files use the same content hierarchy and design intent, but pagination can differ because browsers, PDFKit, Microsoft Word, and LibreOffice use different text-layout engines. Export quality depends on the verified structured claims; correcting missing or incorrectly grouped source information still belongs in the verification workflow.
- **Primary files:**
  - `packages/contracts/src/resume/document.ts`
  - `packages/resume-engine/src/document/build-professional-resume.ts`
  - `packages/resume-renderer/src/professional-resume.tsx`
  - `apps/api/src/modules/tailoring/resume-export-service.ts`
  - `apps/api/src/http/routes/tailoring.ts`
  - `apps/web/components/tailoring/resume-document-page.tsx`
  - `apps/web/app/tailoring/[tailoringSessionId]/resume/page.tsx`

### 14. Evidence-Backed ATS Improvement Actions

- **Date:** 2026-10-05
- **Status:** Complete
- **Scope delivered:**
  - Added a second durable, lease-backed Gemini generation workflow that targets only `can_improve` ATS findings connected to verified resume claims and excludes genuinely missing requirements.
  - Added evidence-bound improvement review with original/proposed wording, requirement rationale, manual editing, accept/reject decisions, optimistic revisions, numeric-claim protection, retry handling, and shared AI quota enforcement.
  - Create each approved improvement set as a new immutable `ats_improved` resume version in the same MongoDB transaction that completes the review, leaving the original tailored version unchanged.
  - Re-run transparent ATS analysis for the revised version, retain both snapshots, display the before/after compatibility score, and upgrade only accepted partial requirement matches in the new snapshot.
  - Added original/improved version switching as a reversible rollback control; preview and PDF/DOCX export resolve the currently active version.
  - Added responsive queued, generating, failed, review, completed-comparison, and no-eligible-improvement states to the existing ATS experience.
- **Verification:** 78 API tests, 43 web tests, and 4 resume-engine tests pass. Coverage includes owner-only durable workflow creation, operation-keyed quota idempotency, evidence-filtered generation, edited acceptance and reload restoration, deterministic prevention of score increases for unchanged wording, immutable revised-version creation, legitimate score improvement, revised snapshot binding, rollback state, and frontend review interaction. Workspace type checking, linting, Prettier validation, production builds, and `git diff --check` pass.
- **Important limitations:** Live Gemini output was not invoked during automated verification, and the completed responsive workflow has not yet received a fresh manual browser/visual QA pass. Version history is persisted in `resume_versions`, but a full user-facing history timeline and retention/deletion management remain the next milestone.
- **Primary files:**
  - `packages/contracts/src/ats/analysis.ts`
  - `packages/contracts/src/tailoring/session.ts`
  - `apps/api/src/modules/tailoring/tailoring-repository.ts`
  - `apps/api/src/modules/tailoring/tailoring-service.ts`
  - `apps/api/src/http/routes/tailoring.ts`
  - `apps/web/components/tailoring/ats-analysis-page.tsx`
  - `apps/web/components/tailoring/resume-document-page.tsx`
  - `apps/web/lib/tailoring/client.ts`

### 15. Free Product Model

- **Date:** 2026-10-08
- **Status:** Complete
- **Scope delivered:**
  - Made Make My Resume a free product with no paid tiers, subscriptions, checkout, upgrade paths, or generation-credit UI.
  - Removed the homepage pricing section and all plan links, paid-tier messaging, credit-card language, and limited-free-resume claims.
  - Replaced dashboard plan and credit cards with truthful resume, completed-tailoring, and in-progress workflow metrics.
  - Removed credit counters from authenticated tailoring navigation and aligned the PRD, API, database, and system designs with the free-product decision.
  - Retained per-user AI request throttles strictly as operational abuse and cost protection; they are not user-purchasable credits or product tiers.
- **Verification:** All 43 web tests pass. Workspace type checking, linting, Prettier validation, and the complete production build pass.
- **Primary files:**
  - `apps/web/app/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/dashboard/dashboard.module.css`
  - `apps/web/components/tailoring/workspace-shell.tsx`
  - `docs/Resume Tailoring SaaS PRD.md`
  - `docs/Resume Tailoring SaaS API Design.md`
  - `docs/Resume Tailoring SaaS Database Design.md`
  - `docs/Resume Tailoring SaaS System Design.md`

### 16. Permanent Resume Deletion

- **Date:** 2026-10-08
- **Status:** Complete
- **Scope delivered:**
  - Added an owner-only dashboard delete action with an explicit irreversible-action confirmation and recoverable error state.
  - Delete the original resume object from private Cloudflare R2 before removing application metadata, keeping failures retryable.
  - Cascade deletion through extraction jobs, job descriptions, tailoring sessions, immutable resume versions, file metadata, and the logical resume/import records.
  - Remove deleted resume and tailoring activity from the dashboard immediately after the API confirms deletion.
- **Verification:** 81 API tests and 45 web tests pass, including owner isolation, R2 deletion invocation, retryable storage failure, extraction cleanup, confirmation behavior, immediate dashboard removal, and recoverable UI errors. Workspace type checking, linting, Prettier validation, the full production build, and `git diff --check` pass.
- **Important limitation:** Automated tests use the storage adapter boundary and do not delete a real user object from the configured R2 bucket. Production deletion requires the configured R2 token to retain object read/write permission.
- **Primary files:**
  - `apps/api/src/http/routes/resume-imports.ts`
  - `apps/api/src/modules/resumes/resume-import-repository.ts`
  - `apps/api/src/modules/resumes/resume-extraction-repository.ts`
  - `apps/api/src/modules/job-descriptions/job-description-repository.ts`
  - `apps/api/src/modules/tailoring/tailoring-repository.ts`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/lib/resume/import-client.ts`
  - `docs/Resume Tailoring SaaS API Design.md`

### 17. Dashboard Tailored-Draft Library

- **Date:** 2026-10-08
- **Status:** Complete
- **Scope delivered:**
  - Added a dedicated responsive dashboard library for completed and in-progress tailoring sessions.
  - Added direct view/continue actions plus one-click PDF and DOCX downloads for completed versions.
  - Added owner-only permanent draft deletion with explicit confirmation and recoverable error handling.
  - Delete only the tailored and ATS-improved versions created by the selected session, preserving the verified base resume and reusable job analysis.
- **Verification:** 81 API tests and 46 web tests pass, including owner-only session deletion, completed-version view routing, direct PDF download, permanent-delete confirmation, immediate dashboard removal, and preservation messaging for the verified base resume. Workspace type checking, linting, Prettier validation, the full production build, and `git diff --check` pass.
- **Primary files:**
  - `apps/api/src/http/routes/tailoring.ts`
  - `apps/api/src/modules/tailoring/tailoring-repository.ts`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/dashboard/dashboard.module.css`
  - `apps/web/lib/tailoring/client.ts`

### 18. Dedicated Resume and Activity Workspaces

- **Date:** 2026-10-08
- **Status:** Complete
- **Scope delivered:**
  - Replaced the dashboard's resume and activity hash links with first-class `/resumes` and `/activity` routes.
  - Centralized desktop and mobile workspace navigation so only the current route receives the active underline or active mobile state.
  - Added a complete owned-resume library with upload, verification, tailoring, replacement, and permanent Cloudflare-backed deletion actions.
  - Added a complete chronological activity view that combines every available resume and tailoring workflow instead of truncating the dashboard's recent-activity preview.
  - Preserved authenticated redirects, account controls, recoverable loading/error states, responsive layouts, and mobile bottom navigation on both routes.
- **Verification:** 54 web tests pass across 11 files, including dedicated-route navigation, active-route semantics, complete untruncated resume/activity rendering, permanent deletion, and signed-out redirects. Web type checking, linting, the Next.js production build, and `git diff --check` pass.
- **Primary files:**
  - `apps/web/components/dashboard/workspace-navigation.tsx`
  - `apps/web/components/dashboard/workspace-collection-page.tsx`
  - `apps/web/app/resumes/page.tsx`
  - `apps/web/app/activity/page.tsx`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/dashboard/dashboard.module.css`

## Next Major Milestone

Resume version history and management are next: expose the immutable baseline, tailored, and ATS-improved versions in a user-facing timeline with names, timestamps, comparison, restore controls, and deletion/retention rules. Additional resume templates, presentation controls, saved export artifacts, and sharing can build on the canonical document model after version management is stable.

## Status Definitions

- **Not started:** No implementation work has begun.
- **In progress:** Active implementation exists but the feature is not ready for its intended use.
- **Blocked:** Progress depends on a decision, external system, credential, or unresolved technical constraint.
- **Complete:** The agreed scope is implemented and verified in proportion to its risk.
- **Deferred:** The feature was intentionally moved out of the current delivery scope.
