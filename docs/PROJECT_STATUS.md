# Make My Resume — Project Status

Last updated: 2026-10-13

## Purpose

This document is the durable progress log for the Make My Resume project. It records major product, platform, and infrastructure milestones so the current state of the project can be understood without reconstructing it from commit history.

Update this file whenever a major feature is started, completed, materially redesigned, or intentionally deferred. Minor styling adjustments, routine refactors, and isolated bug fixes do not need separate milestone entries unless they change the status of a major feature.

## Current Snapshot

| Area                     | Status   | Summary                                                                                                                                                                                                                                            |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project foundation       | Complete | pnpm/Turborepo monorepo with web, API, shared contracts, resume engine, renderer, linting, TypeScript, and test foundations.                                                                                                                       |
| Marketing homepage       | Complete | Responsive Stitch-inspired homepage implementing the Atelier Digital visual system and core product messaging.                                                                                                                                     |
| Authentication           | Complete | Better Auth email/password authentication includes Resend-backed, rate-limited password recovery with single-use tokens and session revocation. Social OAuth was intentionally removed from the supported product scope.                           |
| Dashboard workspace      | Complete | Responsive authenticated dashboard implements the approved desktop and mobile Stitch designs with truthful empty, loading, navigation, activity, resume management, tailored-draft management, trust states, and dedicated resume/activity routes. |
| Resume workflows         | Complete | The full MVP flow is implemented: PDF/DOCX import, grounded extraction and verification, job matching, evidence-backed tailoring, ATS improvement, immutable versions, customizable PDF/DOCX export, deletion, and unlisted revocable sharing.     |
| Backend business modules | Complete | Owned imports, private R2 originals, recoverable queues, grounded AI workflows, transactional versions, ATS analysis, deterministic export, and persistent owner-controlled private sharing are complete for the MVP.                              |

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

- **Date:** 2026-10-01; email-only scope finalized 2026-10-13
- **Status:** Complete
- **Scope delivered:**
  - Added Better Auth to the Express API with credentialed CORS, trusted-origin validation, secure cookie settings, and a protected current-user endpoint.
  - Added optional Better Auth Infrastructure dashboard integration when `BETTER_AUTH_API_KEY` is configured.
  - Added a development-safe in-memory auth store and a production-ready MongoDB adapter selected through environment configuration.
  - Kept `.env.example` bootable by supplying a development-only authentication secret that satisfies the same minimum-length validation as real secrets while remaining explicitly unsuitable for production.
  - Added email/password sign-up, sign-in, session restoration, sign-out, password recovery, and safe post-auth redirects.
  - Finalized authentication as an email/password-only workflow and removed the Google provider, provider-discovery endpoint, social sign-in UI, and obsolete provider credentials from the example environment.
  - Built responsive Stitch-inspired sign-in and sign-up pages with clear loading, validation, and error states.
  - Added a protected dashboard shell that redirects signed-out visitors and provides the entry point for future resume workflows.
- **Verification:** Workspace type checking, linting, automated API and web tests, formatting, and the production build pass. Regression coverage confirms that the provider-configuration endpoint is absent and the authentication page exposes only email/password controls. The sign-up API, browser sign-in, protected dashboard, sign-out redirect, desktop layouts, and 390 px mobile layouts were previously verified with no horizontal overflow or browser console errors.
- **Deployment note:** Local development uses the in-memory adapter by default. Production authentication persistence requires MongoDB. Better Auth Infrastructure is enabled only when its separate API key is supplied; the API key does not replace `BETTER_AUTH_SECRET`.
- **Product decision:** Social OAuth is outside the agreed authentication scope; email/password plus password recovery is the complete supported workflow.
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
- **Remaining limitations:** Production HTTPS cookie attributes require deployment-environment testing; natural multi-day session renewal and a forced database outage were not exercised. The dashboard is a client-side protected shell, so all future private data endpoints must retain server-side authorization.
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
  - Added recoverable sign-out and email-authentication service error states.
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
- **Remaining limitation:** Production delivery requires an address on a domain verified in Resend. Deployments behind a reverse proxy must set `TRUSTED_PROXY_IPS` to the proxy's exact IPs or CIDRs.
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
  - Made upload cancellation a two-phase operation: cancellation first claims the import, R2 deletion must succeed before metadata becomes terminal, and a storage failure releases the claim so the user can retry without leaving an acknowledged private object behind.
  - Connected the dashboard summary, resume library, and recent activity to the authenticated resume API.
- **Verification:** 31 API tests and 27 web tests pass. Workspace type checking, linting, Prettier validation, and the production build pass. Regression coverage includes cancellation racing both successful and failed verification, signed content-length propagation, cleanup on failed-dialog dismissal, and keeping the dialog open when cleanup cannot be confirmed. A live R2 size-enforcement check accepted an exact five-byte PUT with HTTP 200 and rejected a six-byte PUT using the same five-byte signed URL with HTTP 403; the temporary object was removed. A prior live browser pass verified the complete direct-upload, API verification, success, and dashboard-refresh flow at desktop and 390 × 844 mobile sizes without console warnings or errors. All disposable QA data was removed afterward.
- **Important limitation:** Resume content extraction and user verification belong to the following milestone. DOCX validation currently confirms the ZIP container signature; full Office-package validation will happen with extraction.
- **Scope superseded in milestone 9:** Image import support was removed before extraction shipped. The supported input set is now deliberately limited to PDF and DOCX.
- **Primary files:**
  - `apps/api/src/http/routes/resume-imports.ts`
  - `apps/api/src/infrastructure/storage/r2-object-storage.ts`
  - `apps/api/src/modules/resumes/resume-import-repository.ts`
  - `apps/web/components/dashboard/resume-upload-dialog.tsx`
  - `apps/web/lib/resume/import-client.ts`
  - `packages/contracts/src/resume/import.ts`

### 9. Resume Extraction and Evidence Verification

- **Date:** 2026-10-02; AI parsing extension completed 2026-10-03; source hyperlink preservation extended 2026-10-13
- **Status:** Complete
- **Scope delivered:**
  - Restrict resume imports to PDF and DOCX documents; image and OCR-based imports are intentionally deferred.
  - Added worker-safe, atomically claimed, retryable extraction jobs backed by memory or MongoDB persistence, with private originals read directly from Cloudflare R2.
  - Added PDF.js and Mammoth extraction with bounded document text, PDF page provenance, deterministic section classification, and explicit failure states for unreadable documents.
  - Preserve safe `http`/`https` project hyperlink targets from PDF link annotations and DOCX relationships alongside their visible `Live` labels, while rejecting non-web schemes and bounding PDF annotations per page.
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
  - Added parser resource budgets before and during extraction: the 10 MB compressed limit is rechecked, DOCX archives are capped at 2,000 entries and 50 MB expanded content, PDFs are capped at 100 pages, extracted text is capped at 250,000 characters, and parsing has a 15-second deadline.
  - Unified local in-memory import, extraction, tailoring, and version-history state so verified baselines and completed tailored versions can be listed, exported, and privately shared without MongoDB during development.
- **Verification:** 109 API tests, 65 web tests, and 5 resume-engine tests pass. Workspace type checking, linting, Prettier validation, and production builds pass. Regression coverage includes PDF annotation and DOCX relationship hyperlink preservation, grounded AI project-link retention, image-format rejection, legacy-image compatibility, idempotent extraction-job creation, lease expiry and reclamation, stale-worker rejection, abandoned-attempt exhaustion, optimistic concurrent-save rejection, cross-account isolation, immutable provenance, verified-version creation, coordinate-aware PDF word reconstruction, synthetic DOCX provenance, deterministic section classification, grounded Gemini response validation for PDF and DOCX, duplicate and multiple-summary filtering, provider-failure fallback, review UI transitions, retry polling through a second terminal failure, and retry feedback. An isolated live MongoDB check in a disposable database passed concurrent unique upsert, expired-lease reclamation, transactional version and pointer consistency, and full rollback under a forced version-write failure; the database was dropped afterward. A live Gemini smoke test using synthetic résumé content and the configured `gemini-3.8-flash` model returned one personal-information claim, one summary, one role-level experience claim, and one consolidated skills claim with valid page evidence. A generated DOCX smoke document also passed the production extraction path. Manual QA previously passed DOCX and PDF upload/extraction, partial review persistence, verified-version creation, mobile layouts, and dashboard state transitions.
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

- **Date:** 2026-10-04; project hyperlink rendering and classic template corrections extended 2026-10-14
- **Status:** Complete
- **Scope delivered:**
  - Added a canonical professional-resume document model that deterministically transforms the immutable tailored claim set into identity, contact, and ordered resume sections without introducing new facts.
  - Added one polished, single-column Professional ATS template shared by the responsive browser preview, searchable PDF renderer, and editable DOCX renderer.
  - Added comfortable and compact spacing modes for normal and content-heavy resumes while keeping the original uploaded file and verified base version unchanged.
  - Added an authenticated export studio linked from completed tailoring sessions, with explicit original-protection messaging and private, no-store PDF and DOCX download responses.
  - Bound every export to the completed tailored version and preserved accepted wording, section order, contact details, and source-derived headings across both file formats.
  - Preserve source PDF contact and project hyperlink destinations in regenerated output, render project `Live` labels as links in browser previews and both PDF/DOCX downloads, restore the PDF cursor after manually positioned contact rows, and normalize grouped skills, projects, experience, and education into readable resume lines without repeating headings.
  - Backfill missing project destinations at read time from original PDF annotations or DOCX relationships for existing verified versions, tailored results, and public shared previews, so earlier uploads do not require re-uploading.
  - Removed duplicated identity/contact groups from generated resumes when an extracted personal-information claim contains the name, email, and phone together, while retaining the individually parsed contact links.
  - Restore both the missing `Live` label and its source hyperlink for legacy AI-normalized project claims that retained the project but omitted `Live`, including version previews, tailoring results, downloads, and public shares.
  - Preserve named source contact destinations such as LinkedIn, GitHub, and Portfolio during new PDF/DOCX extraction and backfill them from the private original for existing version previews, tailored results, downloads, and public shares.
  - Redesigned the Professional template around the supplied LaTeX résumé reference: compact Letter margins, centered identity and concise contact labels, Summary → Technical Skills → Experience → Projects → Education ordering, classic serif typography, ruled section headings, split role/date and employer/location rows, linked project metadata, compact bullets, bold skills labels, and split institution/degree rows. Legacy records using the old default section order are migrated at read time, while deliberate custom orders remain unchanged. The same semantic hierarchy is used by browser previews and generated PDF/DOCX files without hardcoded personal content.
- **Verification:** 112 API tests, 65 web tests, and 8 resume-engine tests pass. Coverage includes canonical document construction, rejected-claim omission, grouped identity/contact deduplication, legacy default-order migration, generic grouped experience/project/education normalization, named source-contact preservation, contact parsing, searchable PDF text, editable DOCX text, clickable project links in PDF and DOCX output, immutable legacy-claim hyperlink backfill when `Live` is present or absent, authenticated ownership, private cache headers, output filenames, preview rendering, layout-density selection, both download actions, and compile-safe pdf.js text-item narrowing. Workspace type checking, linting, Prettier validation, production builds, and `git diff --check` pass. A fresh one-page PDF generated through the production renderer from representative grouped claims and the supplied source PDF annotations was rendered to PNG and inspected at full-page resolution; it had the intended LaTeX-style hierarchy, clean split rows, compact bullets, concise linked `Live` labels, correct Letter sizing, and no clipping, overlap, or missing glyphs.
- **Important limitations:** Three single-column template variants and two density settings are available. Browser preview and exported files use the same content hierarchy and design intent, but pagination can differ because browsers, PDFKit, Microsoft Word, and LibreOffice use different text-layout engines. The classic split-row treatment depends on recognizable role, date, location, project, and education delimiters in the verified structured claims; unusual source layouts fall back to the standard readable item treatment.
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

### 17. Tailored-Version Library and Inline Preview

- **Date:** 2026-10-08
- **Status:** Complete
- **Scope delivered:**
  - Group completed and in-progress tailoring sessions beneath their source resume in the dedicated `/resumes` library instead of duplicating them in a separate dashboard section.
  - Open completed versions in a responsive inline professional-resume preview with comfortable and compact density controls, direct PDF and DOCX downloads, and a link back to the tailoring editor.
  - Replace the completed tailoring screen's raw claim-by-claim summary with the same canonical Professional ATS document, including in-place spacing controls and direct PDF/DOCX exports.
  - Route completed dashboard and activity entries to the associated grouped version while retaining the standalone preview route as a direct-link fallback.
  - Added owner-only permanent draft deletion with explicit confirmation and recoverable error handling.
  - Delete only the tailored and ATS-improved versions created by the selected session, preserving the verified base resume and reusable job analysis.
- **Verification:** 81 API tests and 55 web tests pass, including owner-only session deletion, grouped-version rendering, canonical completed-page and inline previews, density-aware PDF/DOCX downloads, permanent-delete confirmation, immediate library removal, completed-activity routing, and preservation messaging for the verified base resume. Workspace type checking, linting, Prettier validation, the full production build, and `git diff --check` pass.
- **Primary files:**
  - `apps/api/src/http/routes/tailoring.ts`
  - `apps/api/src/modules/tailoring/tailoring-repository.ts`
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/dashboard/dashboard.module.css`
  - `apps/web/components/dashboard/workspace-collection-page.tsx`
  - `apps/web/components/tailoring/tailoring-session-page.tsx`
  - `apps/web/lib/tailoring/client.ts`

### 18. Dedicated Resume and Activity Workspaces

- **Date:** 2026-10-08
- **Status:** Complete
- **Scope delivered:**
  - Replaced the dashboard's resume and activity hash links with first-class `/resumes` and `/activity` routes.
  - Centralized desktop and mobile workspace navigation so only the current route receives the active underline or active mobile state.
  - Added a complete owned-resume library with upload, verification, tailoring, replacement, and permanent Cloudflare-backed deletion actions.
  - Grouped every tailored version beneath its source resume with an in-place preview, download, editor, and deletion workflow.
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

### 19. Resume Version History and Management

- **Date:** 2026-10-10
- **Status:** Complete
- **Scope delivered:**
  - Added an owner-only immutable version API for verified baselines, tailored snapshots, ATS-improved snapshots, and restored copies, backed directly by `resume_versions` and the logical resume record.
  - Added a dedicated responsive `/resumes/:resumeId/versions` workspace with an ordered timeline, truthful active-version state, canonical Professional ATS previews, and version-specific PDF/DOCX exports.
  - Added exact side-by-side claim comparison with changed and unchanged states so users can inspect wording differences without losing context.
  - Added server-enforced activation, display-name editing, and restore-as-copy behavior; restoration creates a new immutable active snapshot rather than rewriting history.
  - Added dependency-aware permanent deletion that protects every baseline and active version, blocks snapshots referenced by restored copies, and removes a tailoring workflow and all of its generated versions together when required.
  - Added a first-class Version history action to every verified resume in the resume library.
- **Verification:** 85 API tests and 58 web tests pass, including owner isolation, timeline ordering, baseline and active-version protection, rename, activation, immutable restoration, deletion, private version-specific DOCX export, professional preview rendering, comparison highlighting, scoped authentication redirects, and resume-library routing. Full workspace type checking, linting, Prettier validation, production builds, and `git diff --check` pass.
- **Important limitations:** Existing generated snapshots receive deterministic names from their company and role until users rename them. Deleting a tailored or ATS-improved snapshot intentionally deletes its complete tailoring workflow because those versions share session state. The first release compares structured verified claims rather than a visual pixel-level document diff.
- **Primary files:**
  - `packages/contracts/src/resume/version.ts`
  - `apps/api/src/modules/resumes/resume-version-repository.ts`
  - `apps/api/src/http/routes/resume-versions.ts`
  - `apps/web/lib/resume/version-client.ts`
  - `apps/web/components/resume/resume-version-history-page.tsx`
  - `apps/web/components/resume/resume-version-history.module.css`
  - `apps/web/app/resumes/[resumeId]/versions/page.tsx`

### 20. Resume Template and Styling Studio

- **Date:** 2026-10-10
- **Status:** Complete
- **Scope delivered:**
  - Added three curated, single-column ATS-safe templates: Professional, Modern, and Compact.
  - Added per-version typography, accent color, comfortable/compact spacing, section visibility, and section-order controls in a responsive Design view within version history.
  - Persist presentation settings on each immutable resume version with owner-only API validation and backward-compatible defaults for existing snapshots.
  - Keep verified wording unchanged while applying section presentation choices through a shared deterministic resume-engine transformation.
  - Use saved presentation settings for the browser preview and version-specific PDF/DOCX exports; tailoring-session downloads also resolve the settings stored on their active generated version.
  - Preserve presentation settings when a historical version is restored as a new immutable copy.
- **Verification:** 86 API tests, 59 web tests, and 5 resume-engine tests pass. Full workspace type checking, linting, Prettier validation, production builds, and `git diff --check` pass. Representative Professional, Modern, and Compact PDFs and DOCX files were generated, rendered to six page images with Poppler and the bundled LibreOffice runtime, and visually inspected with no clipping, overlap, broken wrapping, missing glyphs, or unstable page breaks.
- **Important limitations:** The first release intentionally keeps every template single-column and limits users to curated typography and color choices. It does not provide arbitrary positioning, multi-column layouts, images, decorative skill charts, or pixel-level parity between browser, PDFKit, and Word layout engines.
- **Primary files:**
  - `packages/contracts/src/resume/document.ts`
  - `packages/resume-engine/src/document/apply-resume-presentation.ts`
  - `packages/resume-renderer/src/professional-resume.tsx`
  - `apps/api/src/modules/resumes/resume-version-repository.ts`
  - `apps/api/src/modules/tailoring/resume-export-service.ts`
  - `apps/api/src/http/routes/resume-versions.ts`
  - `apps/web/components/resume/resume-version-history-page.tsx`
  - `apps/web/components/resume/resume-version-history.module.css`

### 21. Private Resume Sharing

- **Date:** 2026-10-13
- **Status:** Complete
- **Scope delivered:**
  - Added persistent owner-controlled private links bound to one immutable resume version, with high-entropy opaque bearer tokens and unique MongoDB indexes.
  - Added create, copy, preview, disable, re-enable, and regenerate controls directly in the version-history workspace. Regeneration immediately invalidates the previous URL.
  - Surfaced a polished quick-share link action on every verified resume card and in the final export studio. The action resolves the active immutable version, creates or re-enables its private link, copies it when clipboard access is available, and provides a manual-copy fallback.
  - Added the unlisted `/r/:shareToken` experience with the selected version's saved template and presentation settings, responsive desktop/mobile rendering, a public PDF download, and a neutral unavailable state for disabled, regenerated, unknown, deleted-version, or deleted-resume links.
  - Kept public responses free of account, source-file, provenance, and unrelated-version data; only the derived display document and selected presentation settings are returned.
  - Added `noindex`, `nofollow`, and no-cache metadata to the public page, `no-store` response headers to public and owner share APIs, and bearer-token redaction for API request URLs.
  - Protected public PDF generation with a per-link-and-client-IP limit of 20 downloads per minute plus a bounded ten-minute, version-specific in-process cache that coalesces concurrent renders and avoids repeated R2 reads and PDF rendering.
  - Hardened legacy hyperlink recovery so links are restored only from the same immutable claim's source text, using its stable claim identity; edited/rejected claims preserve explicit removals, and deleting or reordering projects cannot transfer a URL to another project.
  - Resolve project `Live` targets from the URL explicitly associated with the `Live` label, using a generic URL only when exactly one unambiguous project URL exists; the browser, PDF, and DOCX renderers share this behavior.
  - Removed source-file reads from version/public preview and export paths, eliminating duplicate PDF/DOCX parsing. Added a bounded version-specific public-preview cache with concurrent-request coalescing and per-link/IP throttling.
  - Validate public bearer links before allocating valid-link export/preview rate-limit state. Malformed and unknown links use a separate IP-scoped limiter so fabricated tokens cannot evict or reset a valid link's allowance.
  - Preserve the generated private URL as a manual-copy field when browser clipboard permission exists but rejects the write.
  - Connected resume and version deletion to private-link cleanup. Even if cleanup is interrupted, ownership/version resolution prevents an orphaned link from exposing deleted content.
- **Verification:** 123 API tests and 68 web tests pass, including owner isolation, idempotent link creation, active-version quick sharing, selected-version rendering, cached and rate-limited private PDF export and preview, separate invalid-token throttling, stable-claim hyperlink recovery, explicit link-removal preservation, unambiguous `Live` URL selection, clipboard-rejection fallback, immediate disable/re-enable behavior, token regeneration, neutral invalid-link handling, deleted-version cleanup, retryable R2 cancellation, parser resource budgets, shared in-memory version visibility, owner dialog interactions, public rendering, and public download behavior. Full workspace type checking, linting, Prettier validation, production builds, and `git diff --check` pass. A live browser pass previously verified the valid and unavailable public states, saved-template rendering, clickable email/phone/web contacts, `noindex` metadata, zero horizontal overflow at the available compact viewport, and no application console warnings or errors. Live API logs confirmed that share bearer tokens are redacted.
- **Important limitations:** Private links are bearer URLs: anyone who receives the exact URL can access the selected version until the owner disables or regenerates it. Expiring links, password protection, access analytics, and durable pre-generated export artifacts are intentionally outside this MVP increment. The current export cache is bounded, process-local, and short-lived; cache misses still generate the PDF on demand without placing it in public storage.
- **Primary files:**
  - `packages/contracts/src/resume/share.ts`
  - `apps/api/src/modules/resumes/resume-share-repository.ts`
  - `apps/api/src/http/routes/resume-shares.ts`
  - `apps/web/components/resume/public-resume-page.tsx`
  - `apps/web/components/resume/private-resume-share-button.tsx`
  - `apps/web/components/resume/resume-version-history-page.tsx`
  - `apps/web/app/r/[shareToken]/page.tsx`

## Next Major Milestone

The resume-tailoring MVP workflow is now complete. The next milestone is production launch readiness: deploy the web/API/worker stack with MongoDB, R2, and Resend, validate HTTPS cookies and proxy configuration, add operational monitoring and backups, and run a clean end-to-end production QA pass. Saved export artifacts, expiring/password-protected links, and share analytics can follow after launch stability.

## Status Definitions

- **Not started:** No implementation work has begun.
- **In progress:** Active implementation exists but the feature is not ready for its intended use.
- **Blocked:** Progress depends on a decision, external system, credential, or unresolved technical constraint.
- **Complete:** The agreed scope is implemented and verified in proportion to its risk.
- **Deferred:** The feature was intentionally moved out of the current delivery scope.
