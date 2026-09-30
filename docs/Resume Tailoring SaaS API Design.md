# Resume Tailoring SaaS
## API Design Document — MVP v1.0

**Status:** Ready for implementation  
**API style:** REST  
**API version:** v1  
**Backend:** Node.js + Express + TypeScript  
**Database:** MongoDB  
**Authentication:** Better Auth  
**Storage:** Cloudflare R2  
**Email:** Resend  
**Architecture:** Modular Monolith

---

# 1. Purpose

This document defines the API contract for the Resume Tailoring SaaS MVP.

The API provides the backend interface for:

- Authentication integration
- Resume management
- Resume import
- Resume parsing
- Resume editing
- Resume versions
- Job descriptions
- Job analysis
- Resume/job matching
- AI resume tailoring
- AI suggestions
- ATS analysis
- ATS improvement
- PDF generation
- Resume sharing
- Usage limits
- Billing
- Background jobs

The API is designed around the modular-monolith architecture established in the System Design document.

---

# 2. API Architecture

The general request flow is:

```text
Client
  ↓
HTTPS
  ↓
Express API
  ↓
Authentication
  ↓
Authorization
  ↓
Validation
  ↓
Controller
  ↓
Service
  ↓
Repository / Infrastructure
  ↓
MongoDB / R2 / AI / Email / Payment
```

---

# 3. Base URL

Production:

```text
https://api.example.com/api/v1
```

Development:

```text
http://localhost:<port>/api/v1
```

All application APIs use:

```text
/api/v1
```

This gives us room for future breaking API changes:

```text
/api/v2
```

without breaking existing clients.

---

# 4. API Style

The MVP uses:

> **REST + JSON**

with:

- Resource-oriented URLs
- Standard HTTP methods
- JSON request/response bodies
- HTTP status codes
- Schema validation
- Consistent error responses

We are not using GraphQL for the MVP.

---

# 5. Authentication

Authentication is handled by **Better Auth**.

Business APIs consume the authenticated session rather than implementing their own login/session system.

Conceptually:

```text
Browser
   ↓
Better Auth
   ↓
Authenticated Session
   ↓
Express API
```

Required authentication methods:

- Email/password
- Google OAuth

---

# 6. Authentication API Ownership

Better Auth-managed routes are considered authentication infrastructure.

The application should not recreate:

```text
/login
/signup
/password-reset
/session
```

inside the business API.

Instead, Better Auth handles these flows.

The Resume SaaS API starts at:

```text
/api/v1/...
```

and assumes an authenticated session for protected endpoints.

---

# 7. Authentication Header / Session

The preferred approach is an HTTP-only secure session cookie managed by Better Auth.

Browser:

```text
Browser
  ↓
Secure Cookie
  ↓
Better Auth Session
```

The frontend must never need access to raw authentication secrets.

The Express API obtains the authenticated user through the shared authentication layer.

---

# 8. Authorization Model

Authentication answers:

> Who is the user?

Authorization answers:

> Can this user access this resource?

Every protected request follows:

```text
Request
 ↓
Authenticate
 ↓
Get userId
 ↓
Load resource
 ↓
Verify ownership
 ↓
Execute operation
```

Example:

```text
GET /api/v1/resumes/resume_123
```

The API must verify:

```text
resume.userId === authenticatedUser.id
```

before returning the resume.

---

# 9. CORS

Because the frontend is hosted on Vercel and the API on Render, cross-origin requests must be configured.

Only trusted frontend origins should be allowed.

Example:

```text
https://app.example.com
```

Development origins may include:

```text
http://localhost:3000
```

Credentials must be supported because authentication uses secure cookies.

The API must not use:

```text
Access-Control-Allow-Origin: *
```

with credentialed requests.

---

# 10. Standard Response Format

Successful responses should be predictable.

Example:

```json
{
  "data": {
    "id": "resume_123",
    "name": "Software Engineer Resume"
  }
}
```

For collections:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "hasNextPage": true
  }
}
```

For asynchronous operations:

```json
{
  "data": {
    "jobId": "job_123",
    "status": "queued"
  }
}
```

---

# 11. Standard Error Format

All API errors should use a consistent structure.

```json
{
  "error": {
    "code": "RESUME_NOT_FOUND",
    "message": "Resume not found.",
    "requestId": "req_123"
  }
}
```

The frontend should rely on `code`, not parse human-readable messages.

---

# 12. Standard HTTP Status Codes

| Status | Meaning |
|---|---|
| `200` | Successful request |
| `201` | Resource created |
| `202` | Request accepted for asynchronous processing |
| `204` | Successful request with no response body |
| `400` | Invalid request |
| `401` | Authentication required |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict / stale state / duplicate |
| `413` | Payload too large |
| `415` | Unsupported media type |
| `422` | Validation/business-rule failure |
| `429` | Rate limit or quota exceeded |
| `500` | Internal server error |
| `502` | External provider failure |
| `503` | Service temporarily unavailable |

---

# 13. Request Validation

Every incoming request must be validated.

Validation applies to:

- Body
- Query parameters
- Path parameters
- Headers
- Webhooks

Conceptually:

```text
Request
 ↓
Schema Validation
 ↓
Normalized Input
 ↓
Business Logic
```

The application should use a shared TypeScript validation layer so frontend and backend can use common schemas where practical.

---

# 14. Resource Naming

Use plural nouns for top-level resources.

Examples:

```text
/resumes
/job-descriptions
/tailoring-sessions
/suggestions
/ats-analyses
/share-links
/usage
```

Use kebab-case for URLs.

---

# 15. API Module Structure

The Express API is divided into:

```text
/api/v1
│
├── auth
├── resumes
├── imports
├── files
├── versions
├── job-descriptions
├── matching
├── tailoring-sessions
├── suggestions
├── ats
├── share-links
├── jobs
├── usage
├── billing
└── webhooks
```

---

# 16. Resume API

## 16.1 Create Resume

```http
POST /api/v1/resumes
```

Creates an empty structured resume.

### Request

```json
{
  "name": "Software Engineer Resume"
}
```

### Response

```json
{
  "data": {
    "id": "resume_123",
    "name": "Software Engineer Resume",
    "baseVersionId": "version_001",
    "createdAt": "2026-09-27T10:00:00Z"
  }
}
```

### Status

```text
201 Created
```

---

# 17. List Resumes

```http
GET /api/v1/resumes
```

### Query parameters

```text
?page=1
&limit=20
&sort=updatedAt
&order=desc
```

### Response

```json
{
  "data": [
    {
      "id": "resume_123",
      "name": "Software Engineer Resume",
      "baseVersionId": "version_001",
      "versionCount": 4,
      "updatedAt": "2026-09-27T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "hasNextPage": false
  }
}
```

---

# 18. Get Resume

```http
GET /api/v1/resumes/:resumeId
```

Returns:

- Resume metadata
- Base version
- Current version
- Version summary

Does not automatically return every historical version.

### Response

```json
{
  "data": {
    "id": "resume_123",
    "name": "Software Engineer Resume",
    "baseVersionId": "version_001",
    "currentVersionId": "version_004"
  }
}
```

---

# 19. Update Resume Metadata

```http
PATCH /api/v1/resumes/:resumeId
```

### Request

```json
{
  "name": "Frontend Engineer Resume"
}
```

### Response

```json
{
  "data": {
    "id": "resume_123",
    "name": "Frontend Engineer Resume",
    "updatedAt": "2026-09-27T10:35:00Z"
  }
}
```

---

# 20. Delete Resume

```http
DELETE /api/v1/resumes/:resumeId
```

The MVP uses logical/soft deletion.

### Response

```text
204 No Content
```

Associated cleanup can happen asynchronously.

---

# 21. Resume Import Architecture

Uploaded files should not be proxied through the Express server when avoidable.

Instead:

```text
Browser
   ↓
Create Import
   ↓
API returns signed R2 upload URL
   ↓
Browser uploads directly to R2
   ↓
Complete Import
   ↓
API creates parsing job
```

This reduces backend bandwidth and makes larger file uploads more scalable.

---

# 22. Create Resume Import

```http
POST /api/v1/imports
```

### Request

```json
{
  "fileName": "resume.pdf",
  "mimeType": "application/pdf",
  "size": 245123,
  "sourceType": "pdf"
}
```

### Response

```json
{
  "data": {
    "importId": "import_123",
    "resumeId": "resume_123",
    "fileId": "file_123",
    "uploadUrl": "https://...",
    "uploadMethod": "PUT",
    "expiresAt": "2026-09-27T10:15:00Z"
  }
}
```

### Status

```text
201 Created
```

---

# 23. Supported File Types

The API accepts:

```text
application/pdf
application/vnd.openxmlformats-officedocument.wordprocessingml.document
image/jpeg
image/png
image/webp
```

The backend must validate both:

- Declared MIME type
- Actual file characteristics

Do not trust the MIME type supplied by the browser.

---

# 24. Complete Resume Import

```http
POST /api/v1/imports/:importId/complete
```

The client calls this after successful upload to R2.

### Response

```json
{
  "data": {
    "importId": "import_123",
    "status": "processing",
    "jobId": "job_123"
  }
}
```

### Status

```text
202 Accepted
```

---

# 25. Resume Parsing Job

The worker performs:

```text
R2 File
 ↓
Document Parser
 ↓
Normalized Content
 ↓
Resume Structure Extraction
 ↓
Structured Resume
 ↓
Base Version
```

The API does not block waiting for the parser.

---

# 26. Get Job Status

```http
GET /api/v1/jobs/:jobId
```

### Response

```json
{
  "data": {
    "id": "job_123",
    "type": "resume_parsing",
    "status": "processing",
    "progress": 65
  }
}
```

Possible states:

```text
queued
processing
completed
failed
cancelled
```

---

# 27. Resume Version API

## List Versions

```http
GET /api/v1/resumes/:resumeId/versions
```

### Response

```json
{
  "data": [
    {
      "id": "version_004",
      "name": "Google Frontend Engineer",
      "versionNumber": 4,
      "versionType": "tailored",
      "jobDescriptionId": "jd_001",
      "createdAt": "2026-09-27T11:00:00Z"
    },
    {
      "id": "version_001",
      "name": "Original Resume",
      "versionNumber": 1,
      "versionType": "base",
      "createdAt": "2026-09-27T10:10:00Z"
    }
  ]
}
```

---

# 28. Get Version

```http
GET /api/v1/versions/:versionId
```

Returns the complete structured resume and design information.

### Response

```json
{
  "data": {
    "id": "version_004",
    "resumeId": "resume_123",
    "name": "Google Frontend Engineer",
    "content": {},
    "design": {},
    "versionType": "tailored",
    "createdAt": "2026-09-27T11:00:00Z"
  }
}
```

---

# 29. Update Current Working Version

```http
PATCH /api/v1/versions/:versionId
```

Used by the structured editor for manual changes.

### Request

```json
{
  "content": {
    "summary": "Updated summary..."
  },
  "revision": 12
}
```

### Response

```json
{
  "data": {
    "id": "version_004",
    "revision": 13,
    "content": {}
  }
}
```

The `revision` field provides optimistic concurrency protection.

Historical/immutable versions cannot be directly edited.

---

# 30. Optimistic Concurrency

A version update can contain:

```json
{
  "revision": 12
}
```

If the server currently has:

```text
revision = 13
```

the API responds:

```text
409 Conflict
```

Example:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The resume was changed elsewhere.",
    "requestId": "req_123"
  }
}
```

This prevents lost updates.

---

# 31. Duplicate Version

```http
POST /api/v1/versions/:versionId/duplicate
```

Creates a new version based on an existing version.

### Request

```json
{
  "name": "Backend Engineer Resume"
}
```

### Response

```json
{
  "data": {
    "versionId": "version_005"
  }
}
```

---

# 32. Restore Version

```http
POST /api/v1/versions/:versionId/restore
```

Restore does not rewrite history.

It creates a new version copied from the selected version.

```text
v1
v2
v3
 ↓
restore v1
 ↓
v4 = restored copy of v1
```

### Response

```json
{
  "data": {
    "restoredVersionId": "version_006",
    "sourceVersionId": "version_001"
  }
}
```

---

# 33. Delete Version

```http
DELETE /api/v1/versions/:versionId
```

The API must check:

- Ownership
- Whether it's the base version
- Whether it's the current version
- Share-link references

### Response

```text
204 No Content
```

---

# 34. Job Description API

## Create Job Description

```http
POST /api/v1/job-descriptions
```

### Request

```json
{
  "resumeId": "resume_123",
  "company": "Example Corp",
  "role": "Frontend Engineer",
  "rawText": "We are looking for..."
}
```

### Response

```json
{
  "data": {
    "id": "jd_001",
    "resumeId": "resume_123",
    "status": "created"
  }
}
```

---

# 35. Get Job Description

```http
GET /api/v1/job-descriptions/:jobDescriptionId
```

Returns:

- Raw JD
- Metadata
- Analysis status
- Structured analysis where available

---

# 36. Analyze Job Description

```http
POST /api/v1/job-descriptions/:jobDescriptionId/analyze
```

The API creates an asynchronous AI job.

### Response

```json
{
  "data": {
    "jobDescriptionId": "jd_001",
    "jobId": "job_201",
    "status": "queued"
  }
}
```

### Status

```text
202 Accepted
```

---

# 37. Job Description Analysis Output

The analysis should contain:

```json
{
  "requiredSkills": [],
  "preferredSkills": [],
  "responsibilities": [],
  "keywords": [],
  "qualifications": [],
  "experienceRequirements": []
}
```

The raw JD remains the source of truth.

The analysis is derived data.

---

# 38. Matching API

## Compare Resume to Job

```http
POST /api/v1/matching
```

### Request

```json
{
  "resumeVersionId": "version_001",
  "jobDescriptionId": "jd_001"
}
```

### Response

```json
{
  "data": {
    "status": "processing",
    "jobId": "job_301"
  }
}
```

---

# 39. Match Result

Conceptually:

```json
{
  "matched": [
    {
      "type": "skill",
      "value": "React"
    }
  ],
  "missing": [
    {
      "type": "skill",
      "value": "AWS"
    }
  ],
  "underrepresented": [
    {
      "type": "experience",
      "value": "REST APIs"
    }
  ],
  "opportunities": []
}
```

Missing information must remain separate from matched information.

---

# 40. Tailoring Session API

The tailoring session represents the complete AI tailoring workflow.

## Create Tailoring Session

```http
POST /api/v1/tailoring-sessions
```

### Request

```json
{
  "resumeVersionId": "version_001",
  "jobDescriptionId": "jd_001"
}
```

### Server process

```text
Authenticate
 ↓
Authorize
 ↓
Check quota
 ↓
Validate resume version
 ↓
Validate JD
 ↓
Create tailoring session
 ↓
Create processing job
```

### Response

```json
{
  "data": {
    "tailoringSessionId": "tailor_001",
    "jobId": "job_401",
    "status": "queued"
  }
}
```

### Status

```text
202 Accepted
```

---

# 41. Tailoring Session GET

```http
GET /api/v1/tailoring-sessions/:sessionId
```

Returns:

- Session status
- Resume reference
- Job reference
- Match status
- Suggestion summary
- Result version where available

Example:

```json
{
  "data": {
    "id": "tailor_001",
    "status": "review",
    "resumeVersionId": "version_001",
    "jobDescriptionId": "jd_001",
    "resultVersionId": null,
    "suggestionSummary": {
      "pending": 7,
      "accepted": 0,
      "rejected": 0
    }
  }
}
```

---

# 42. Tailoring Pipeline

The worker performs:

```text
Resume Version
      +
Job Description
      ↓
JD Analysis
      ↓
Matching
      ↓
AI Tailoring
      ↓
AI Output Validation
      ↓
Suggestion Creation
      ↓
Tailoring Session = review
```

The AI does not directly replace the user's resume.

---

# 43. Tailoring Idempotency

Tailoring requests are expensive and consume quota.

Clients should send:

```http
Idempotency-Key: <unique-client-key>
```

Example:

```http
Idempotency-Key: 5e8c3b0e-...
```

The server uses this key to prevent duplicate generations caused by:

- Double-clicks
- Network retries
- Browser retries
- Client bugs

---

# 44. Idempotent Tailoring Behavior

If the same request is repeated with the same idempotency key:

```text
Existing operation found
        ↓
Return existing session/job
```

instead of:

```text
Create second generation
```

---

# 45. Suggestions API

## Get Suggestions

```http
GET /api/v1/tailoring-sessions/:sessionId/suggestions
```

Optional filtering:

```text
?status=pending
&section=experience
```

### Response

```json
{
  "data": [
    {
      "id": "suggestion_001",
      "target": {
        "versionId": "version_001",
        "section": "experience",
        "itemId": "exp_01",
        "field": "bullets",
        "subItemId": "bullet_01"
      },
      "change": {
        "originalText": "Built APIs using Node.js.",
        "suggestedText": "Built REST APIs using Node.js and Express."
      },
      "reason": "Express is already present in the user's resume.",
      "evidence": [],
      "status": "pending"
    }
  ]
}
```

---

# 46. Accept Suggestion

```http
PATCH /api/v1/suggestions/:suggestionId
```

### Request

```json
{
  "action": "accept"
}
```

The server:

```text
Authenticate
 ↓
Authorize
 ↓
Verify suggestion
 ↓
Verify target version
 ↓
Verify evidence/state
 ↓
Apply change
 ↓
Mark accepted
```

### Response

```json
{
  "data": {
    "suggestionId": "suggestion_001",
    "status": "accepted",
    "versionId": "version_002"
  }
}
```

---

# 47. Reject Suggestion

Same endpoint:

```http
PATCH /api/v1/suggestions/:suggestionId
```

### Request

```json
{
  "action": "reject"
}
```

### Response

```json
{
  "data": {
    "suggestionId": "suggestion_001",
    "status": "rejected"
  }
}
```

---

# 48. Bulk Suggestion Actions

```http
POST /api/v1/tailoring-sessions/:sessionId/suggestions/actions
```

### Request

```json
{
  "action": "accept_all"
}
```

or:

```json
{
  "action": "reject_all"
}
```

### Response

```json
{
  "data": {
    "updated": 7,
    "status": "completed"
  }
}
```

The operation should be idempotent.

---

# 49. Suggestion Safety

The API must not assume an AI suggestion is valid simply because it passed schema validation.

Before application:

```text
Suggestion
 ↓
Target exists?
 ↓
Version unchanged?
 ↓
Suggestion pending?
 ↓
Evidence valid?
 ↓
Apply
```

If the underlying version has changed significantly:

```text
409 Conflict
```

with:

```text
SUGGESTION_STALE
```

---

# 50. ATS API

## Run ATS Analysis

```http
POST /api/v1/ats/analyses
```

### Request

```json
{
  "versionId": "version_002",
  "jobDescriptionId": "jd_001"
}
```

### Response

```json
{
  "data": {
    "analysisId": "ats_001",
    "jobId": "job_501",
    "status": "queued"
  }
}
```

### Status

```text
202 Accepted
```

---

# 51. Get ATS Analysis

```http
GET /api/v1/ats/analyses/:analysisId
```

### Response

```json
{
  "data": {
    "id": "ats_001",
    "overallScore": 84,
    "categoryScores": {
      "keywordCoverage": 90,
      "skillAlignment": 88,
      "experienceRelevance": 80,
      "structure": 94,
      "formatting": 92
    },
    "findings": []
  }
}
```

---

# 52. ATS Analysis Reuse

The API can reuse an existing analysis when:

```text
same version
+
same job description
+
same ATS analysis version
```

This avoids unnecessary processing and AI cost.

---

# 53. Improve ATS

```http
POST /api/v1/ats/improvements
```

### Request

```json
{
  "versionId": "version_002",
  "jobDescriptionId": "jd_001"
}
```

### Response

```json
{
  "data": {
    "jobId": "job_601",
    "status": "queued"
  }
}
```

The result eventually becomes suggestion objects.

The same Accept/Reject mechanism is reused.

---

# 54. ATS Improvement Flow

```text
ATS Analysis
     ↓
Findings
     ↓
Improvement Engine
     ↓
Suggestions
     ↓
Accept / Reject
     ↓
Resume Version
```

No automatic direct modification.

---

# 55. PDF Export API

## Request Export

```http
POST /api/v1/versions/:versionId/pdf
```

### Response

```json
{
  "data": {
    "jobId": "job_701",
    "status": "queued"
  }
}
```

### Status

```text
202 Accepted
```

---

# 56. Get PDF

```http
GET /api/v1/versions/:versionId/pdf
```

If already generated:

```json
{
  "data": {
    "status": "available",
    "downloadUrl": "https://..."
  }
}
```

If still processing:

```json
{
  "data": {
    "status": "processing",
    "jobId": "job_701"
  }
}
```

---

# 57. PDF Generation Rules

PDF generation uses:

```text
Resume JSON
 ↓
Resume Renderer
 ↓
HTML/CSS
 ↓
PDF Renderer
 ↓
R2
```

The API does not ask the AI to generate the PDF.

---

# 58. PDF Cache Invalidation

A generated PDF is valid for a specific resume revision.

If:

```text
version.revision changes
```

the existing PDF is considered stale.

A new PDF must be generated.

---

# 59. Share Link API

## Create Share Link

```http
POST /api/v1/versions/:versionId/share-links
```

### Request

```json
{}
```

or optionally:

```json
{
  "regenerate": false
}
```

### Response

```json
{
  "data": {
    "id": "share_001",
    "url": "https://app.example.com/r/9f84...",
    "enabled": true
  }
}
```

---

# 60. List Share Links

```http
GET /api/v1/resumes/:resumeId/share-links
```

Useful for account management.

The API should never return stored token hashes.

---

# 61. Enable / Disable Share Link

```http
PATCH /api/v1/share-links/:shareLinkId
```

### Request

```json
{
  "enabled": false
}
```

### Response

```json
{
  "data": {
    "id": "share_001",
    "enabled": false
  }
}
```

---

# 62. Regenerate Share Link

```http
POST /api/v1/share-links/:shareLinkId/regenerate
```

The old token becomes invalid.

### Response

```json
{
  "data": {
    "id": "share_001",
    "url": "https://app.example.com/r/new-token"
  }
}
```

---

# 63. Public Share API

This is the primary unauthenticated business endpoint.

```http
GET /api/v1/public/share/:token
```

No user authentication is required.

The server:

```text
Token
 ↓
Hash
 ↓
Find ShareLink
 ↓
enabled?
 ↓
Load Version
 ↓
Render public resume
```

Possible response:

```json
{
  "data": {
    "resume": {
      "content": {},
      "design": {}
    },
    "downloadUrl": "https://..."
  }
}
```

The public endpoint must expose only the selected resume version.

It must not expose:

- User ID
- Internal database IDs
- Tailoring sessions
- AI suggestions
- ATS analysis
- Usage data
- Private job-description information

---

# 64. Share Token Security

The API should use:

- Cryptographically random tokens
- Sufficient token entropy
- Token hashing in the database
- No sequential tokens

The raw token exists only in the user's share URL.

---

# 65. Usage API

## Get Usage

```http
GET /api/v1/usage
```

### Response

```json
{
  "data": {
    "plan": "free",
    "limit": 2,
    "used": 1,
    "remaining": 1,
    "period": {
      "start": "2026-09-27T00:00:00Z",
      "end": "2026-09-28T00:00:00Z"
    }
  }
}
```

For Pro, the period is the billing period.

---

# 66. Quota Enforcement

Quota checks occur on the server.

The client cannot decide whether a user has remaining generations.

Tailoring flow:

```text
Tailoring Request
 ↓
Load Subscription/Plan
 ↓
Check Usage
 ↓
Reserve Generation
 ↓
Create Job
```

---

# 67. Quota Reservation

For a successful generation:

```text
reserved
   ↓
consumed
```

For failure:

```text
reserved
   ↓
released
```

This prevents a failed AI request from permanently consuming a generation.

---

# 68. Quota Conflict

When a user has no remaining generation:

```text
429 Too Many Requests
```

Example:

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have reached your current AI generation limit.",
    "requestId": "req_123"
  }
}
```

The frontend can show an upgrade prompt.

---

# 69. Billing API

The payment provider is still provider-neutral.

## Get Subscription

```http
GET /api/v1/billing/subscription
```

### Response

```json
{
  "data": {
    "plan": "pro",
    "status": "active",
    "currentPeriodStart": "2026-09-01T00:00:00Z",
    "currentPeriodEnd": "2026-10-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

---

# 70. Create Checkout

```http
POST /api/v1/billing/checkout
```

### Request

```json
{
  "plan": "pro"
}
```

### Response

```json
{
  "data": {
    "checkoutUrl": "https://payment-provider.example/checkout/..."
  }
}
```

The actual payment provider can be:

```text
Stripe
Dodo
Future provider
```

without changing the public business contract substantially.

---

# 71. Cancel Subscription

```http
POST /api/v1/billing/subscription/cancel
```

### Request

```json
{
  "atPeriodEnd": true
}
```

### Response

```json
{
  "data": {
    "status": "active",
    "cancelAtPeriodEnd": true
  }
}
```

---

# 72. Payment Webhooks

Payment providers communicate through webhooks.

Provider-neutral route:

```http
POST /api/v1/webhooks/payments/:provider
```

Example:

```text
POST /api/v1/webhooks/payments/stripe
```

The API must:

1. Verify webhook signature.
2. Parse event.
3. Check idempotency.
4. Process billing event.
5. Update local subscription state.
6. Return success.

---

# 73. Webhook Idempotency

Payment providers may send the same event more than once.

The API must store the provider event ID.

```text
eventId already processed?
    ↓
Yes → return 200
No  → process event
```

Never apply the same subscription transition twice.

---

# 74. Jobs API

## Get Job

```http
GET /api/v1/jobs/:jobId
```

### Response

```json
{
  "data": {
    "id": "job_123",
    "type": "resume_tailoring",
    "status": "completed",
    "result": {
      "tailoringSessionId": "tailor_001"
    }
  }
}
```

The result structure depends on job type.

---

# 75. Job Progress

Long-running jobs may expose a normalized progress value:

```json
{
  "status": "processing",
  "progress": 60
}
```

Progress can be approximate.

The client must not rely on exact percentage values for correctness.

---

# 76. Job Failure

Example:

```json
{
  "data": {
    "id": "job_123",
    "status": "failed",
    "error": {
      "code": "AI_PROVIDER_UNAVAILABLE",
      "retryable": true
    }
  }
}
```

The user sees a friendly error, while the API preserves a machine-readable code.

---

# 77. Retry API

For certain user-visible failures, the client can trigger a retry.

Example:

```http
POST /api/v1/jobs/:jobId/retry
```

This should only be allowed for retryable failures.

Internal worker retries happen automatically according to the job policy.

---

# 78. API Ownership Rules

For nested resources, authorization must resolve back to the user.

Example:

```text
Suggestion
 ↓
Tailoring Session
 ↓
Resume
 ↓
User
```

A user must not gain access simply because they know:

```text
suggestionId
```

---

# 79. Resource ID Design

Use opaque IDs.

Examples:

```text
user_...
resume_...
version_...
jd_...
tailor_...
suggestion_...
ats_...
share_...
job_...
```

Avoid exposing predictable incremental numeric IDs.

---

# 80. Pagination

Collection endpoints should support pagination.

For MVP, offset-based pagination is sufficient:

```text
?page=1&limit=20
```

Potential later scaling:

```text
?cursor=...
```

Cursor pagination can be introduced if collection sizes become large.

---

# 81. Filtering

Where useful:

```text
GET /resumes/:id/versions?type=tailored
```

```text
GET /tailoring-sessions?status=review
```

```text
GET /suggestions?status=pending
```

Only documented filters should be accepted.

---

# 82. Sorting

Allowed sort values should be whitelisted.

Example:

```text
sort=createdAt
sort=updatedAt
```

Do not allow arbitrary MongoDB field names from the request.

This avoids accidental data exposure and query abuse.

---

# 83. API Rate Limiting

Rate limiting should be applied especially to:

```text
POST /imports
POST /job-descriptions/:id/analyze
POST /matching
POST /tailoring-sessions
POST /ats/analyses
POST /ats/improvements
POST /versions/:id/pdf
POST /share-links
```

Expensive AI operations should have stricter limits than simple GET requests.

---

# 84. Idempotency Header

For mutation endpoints that can safely use it:

```http
Idempotency-Key: <unique-key>
```

Especially:

```text
POST /tailoring-sessions
POST /ats/analyses
POST /versions/:id/pdf
POST /billing/checkout
POST /share-links
```

The server stores the key and relevant request fingerprint.

---

# 85. API Request Correlation

Every incoming request should receive a request ID.

Example:

```http
X-Request-Id: req_123
```

If the client supplies one, validate and propagate it where appropriate.

The API should include the request ID in errors.

---

# 86. Internal Service Boundaries

The route/controller layer should not contain complex business logic.

Example:

```text
POST /tailoring-sessions
        ↓
TailoringController
        ↓
TailoringService
        ↓
UsageService
ResumeService
JobDescriptionService
AIService
JobService
```

This keeps controllers thin.

---

# 87. Repository Pattern

Database access should be isolated.

Example:

```text
TailoringService
      ↓
TailoringRepository
      ↓
MongoDB
```

Business logic should not directly contain raw MongoDB queries throughout controllers.

---

# 88. Service Layer Example

Conceptually:

```typescript
class TailoringService {
  async createSession(input, userId) {
    // authorization
    // quota
    // create session
    // create job
    // return session
  }
}
```

This makes the domain behavior testable without HTTP.

---

# 89. AI Service API Boundary

The business layer interacts with:

```text
AIService
```

not directly with:

```text
OpenAI SDK
Gemini SDK
Claude SDK
```

Example:

```text
TailoringService
       ↓
AIService.tailorResume()
       ↓
ProviderAdapter
```

---

# 90. AI Provider Metadata

AI responses stored in the system should include:

```text
provider
model
promptVersion
schemaVersion
requestId
```

The public API does not need to expose every internal metadata field.

---

# 91. AI Output Validation

The API/worker pipeline:

```text
LLM
 ↓
Structured response
 ↓
Schema validation
 ↓
Domain validation
 ↓
Evidence validation
 ↓
Create suggestion
```

Invalid AI output should never be persisted as a valid suggestion.

---

# 92. Anti-Fabrication API Rule

The tailoring endpoint must enforce the application invariant:

> The AI can propose changes, but cannot directly write unsupported resume facts.

The API therefore separates:

```text
AI proposal
```

from:

```text
User-approved resume content
```

---

# 93. Evidence API Representation

A suggestion may expose:

```json
{
  "evidence": [
    {
      "type": "skill",
      "itemId": "skill_03",
      "value": "Express"
    }
  ]
}
```

The evidence references the structured resume source.

---

# 94. Suggestion Conflict Handling

Suppose:

```text
AI suggestion based on revision 12
```

but the user has already manually edited the resume to:

```text
revision 15
```

The server must not blindly apply the old suggestion.

Response:

```text
409 Conflict
```

with:

```text
SUGGESTION_STALE
```

The UI can then ask the user to refresh/recompute suggestions.

---

# 95. Manual Editing API

Manual editor requests should update only the current working version.

Example:

```http
PATCH /api/v1/versions/version_004
```

Partial updates can be supported:

```json
{
  "content": {
    "experience": [
      {}
    ]
  }
}
```

The server validates the resulting complete resume structure before persistence.

---

# 96. Complete Resume Validation

When a version changes, validate:

- Section structure
- Required field types
- Stable item IDs
- Valid nested objects
- Valid design metadata
- Supported custom section types

A malformed resume should never be saved.

---

# 97. Public API Isolation

The public share API must be isolated from private business endpoints.

Private:

```text
/api/v1/resumes/...
```

Public:

```text
/api/v1/public/share/...
```

This makes it easier to audit what information is publicly exposed.

---

# 98. Public Share Response

The public API should return a dedicated DTO.

Do not return the raw `ResumeVersion` MongoDB document.

Example:

```json
{
  "data": {
    "resume": {
      "personalInfo": {},
      "summary": "",
      "experience": [],
      "education": [],
      "skills": [],
      "projects": []
    },
    "download": {
      "available": true,
      "url": "https://..."
    }
  }
}
```

This prevents accidental leakage of internal fields.

---

# 99. API Security Middleware

Recommended middleware order:

```text
Request ID
   ↓
Logging
   ↓
CORS
   ↓
Rate Limit
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Controller
```

Not every endpoint needs every middleware, but the overall structure should remain consistent.

---

# 100. File Upload Security

Before import completion:

```text
File metadata
 ↓
MIME validation
 ↓
Size validation
 ↓
Storage object verification
 ↓
Processing
```

The processing worker should treat uploaded files as untrusted.

Files must never be executed.

---

# 101. External Provider Failure Handling

Possible external failures:

```text
AI provider unavailable
R2 unavailable
Resend unavailable
Payment provider unavailable
```

The API should translate provider failures into internal error codes.

Example:

```json
{
  "error": {
    "code": "AI_PROVIDER_UNAVAILABLE",
    "message": "The tailoring service is temporarily unavailable.",
    "requestId": "req_123"
  }
}
```

Provider-specific implementation details should not leak into normal API consumers.

---

# 102. Retryable vs Permanent Errors

Example retryable:

```text
AI_PROVIDER_TIMEOUT
AI_PROVIDER_RATE_LIMITED
R2_TEMPORARY_FAILURE
```

Example permanent:

```text
INVALID_FILE
INVALID_RESUME_SCHEMA
QUOTA_EXCEEDED
SUGGESTION_STALE
INVALID_JOB_DESCRIPTION
```

Workers should only retry appropriate errors.

---

# 103. API Caching

For MVP, most private mutable resources should not be aggressively cached.

Potentially cache/reuse:

```text
JD analysis
ATS analysis
Generated PDF
```

when the underlying inputs are unchanged.

---

# 104. ETags / Revision Support

For frequently loaded resources, future support for:

```text
ETag
If-None-Match
```

can be introduced.

The `revision` field already gives us an application-level consistency mechanism for editor updates.

---

# 105. API Versioning Strategy

The first public contract is:

```text
/api/v1
```

Breaking changes require:

```text
/api/v2
```

Non-breaking changes can include:

- New response fields
- Optional request fields
- New endpoints

while preserving existing fields.

---

# 106. API Documentation

The API should eventually be documented using OpenAPI.

Recommended output:

```text
openapi.yaml
```

or generated OpenAPI definitions.

The API documentation should include:

- Authentication
- Endpoints
- Request schemas
- Response schemas
- Error codes
- Examples
- Async job behavior

---

# 107. API Testing Strategy

## Unit tests

Test service logic:

```text
UsageService
VersionService
MatchingService
SuggestionService
BillingService
```

## Integration tests

Test:

```text
API → Service → MongoDB
API → R2
API → Worker
```

## End-to-end tests

Test:

```text
Signup
 ↓
Import
 ↓
Parse
 ↓
JD
 ↓
Tailor
 ↓
Accept
 ↓
ATS
 ↓
PDF
 ↓
Share
```

---

# 108. Critical API Invariants

The following must always hold.

## Invariant 1

Unauthenticated users cannot access private resume APIs.

## Invariant 2

Authenticated users cannot access resources owned by another user.

## Invariant 3

Tailoring cannot overwrite the base resume.

## Invariant 4

AI output cannot directly become final resume content without application-controlled processing.

## Invariant 5

Unsupported skills cannot automatically appear in the tailored resume.

## Invariant 6

Failed tailoring does not permanently consume quota.

## Invariant 7

Duplicate requests with the same idempotency key do not create duplicate generations.

## Invariant 8

Historical versions cannot be silently overwritten.

## Invariant 9

Disabled share links cannot expose the resume.

## Invariant 10

Payment webhooks are idempotent.

---

# 109. Complete Endpoint Summary

## Authentication

Managed by Better Auth.

---

## Resumes

```text
POST   /api/v1/resumes
GET    /api/v1/resumes
GET    /api/v1/resumes/:resumeId
PATCH  /api/v1/resumes/:resumeId
DELETE /api/v1/resumes/:resumeId
```

---

## Imports / Files

```text
POST /api/v1/imports
POST /api/v1/imports/:importId/complete
```

---

## Jobs

```text
GET  /api/v1/jobs/:jobId
POST /api/v1/jobs/:jobId/retry
```

---

## Versions

```text
GET    /api/v1/resumes/:resumeId/versions
GET    /api/v1/versions/:versionId
PATCH  /api/v1/versions/:versionId
DELETE /api/v1/versions/:versionId
POST   /api/v1/versions/:versionId/duplicate
POST   /api/v1/versions/:versionId/restore
```

---

## Job Descriptions

```text
POST /api/v1/job-descriptions
GET  /api/v1/job-descriptions/:jobDescriptionId
POST /api/v1/job-descriptions/:jobDescriptionId/analyze
```

---

## Matching

```text
POST /api/v1/matching
```

---

## Tailoring

```text
POST /api/v1/tailoring-sessions
GET  /api/v1/tailoring-sessions/:sessionId
```

---

## Suggestions

```text
GET   /api/v1/tailoring-sessions/:sessionId/suggestions
PATCH /api/v1/suggestions/:suggestionId

POST /api/v1/tailoring-sessions/:sessionId/suggestions/actions
```

---

## ATS

```text
POST /api/v1/ats/analyses
GET  /api/v1/ats/analyses/:analysisId

POST /api/v1/ats/improvements
```

---

## PDF

```text
POST /api/v1/versions/:versionId/pdf
GET  /api/v1/versions/:versionId/pdf
```

---

## Sharing

```text
POST   /api/v1/versions/:versionId/share-links
GET    /api/v1/resumes/:resumeId/share-links
PATCH  /api/v1/share-links/:shareLinkId
POST   /api/v1/share-links/:shareLinkId/regenerate
```

Public:

```text
GET /api/v1/public/share/:token
```

---

## Usage

```text
GET /api/v1/usage
```

---

## Billing

```text
GET  /api/v1/billing/subscription
POST /api/v1/billing/checkout
POST /api/v1/billing/subscription/cancel
```

---

## Webhooks

```text
POST /api/v1/webhooks/payments/:provider
```

---

# 110. Core API Workflow — Resume Import

```text
POST /imports
       ↓
Get R2 signed URL
       ↓
Browser → R2
       ↓
POST /imports/:id/complete
       ↓
202 Accepted
       ↓
Job created
       ↓
GET /jobs/:id
       ↓
completed
       ↓
GET /resumes/:id
```

---

# 111. Core API Workflow — Tailoring

```text
POST /job-descriptions
       ↓
POST /job-descriptions/:id/analyze
       ↓
POST /matching
       ↓
POST /tailoring-sessions
       ↓
Quota reservation
       ↓
202 Accepted
       ↓
Worker
       ↓
AI
       ↓
Validation
       ↓
Suggestions
       ↓
GET /tailoring-sessions/:id/suggestions
       ↓
Accept / Reject
       ↓
Resume Version
```

---

# 112. Core API Workflow — ATS

```text
POST /ats/analyses
       ↓
Worker
       ↓
Deterministic checks
+
AI analysis
       ↓
ATSAnalysis
       ↓
GET /ats/analyses/:id
       ↓
POST /ats/improvements
       ↓
Suggestions
```

---

# 113. Core API Workflow — PDF

```text
POST /versions/:id/pdf
       ↓
202
       ↓
PDF job
       ↓
Renderer
       ↓
R2
       ↓
GET /versions/:id/pdf
       ↓
download URL
```

---

# 114. Core API Workflow — Public Share

```text
POST /versions/:id/share-links
       ↓
Generate token
       ↓
Return URL

Visitor
       ↓
GET /public/share/:token
       ↓
Resolve token
       ↓
Check enabled
       ↓
Load selected version
       ↓
Return public DTO
```

---

# 115. Recommended API Service Map

```text
HTTP Layer
│
├── ResumeController
├── ImportController
├── VersionController
├── JobDescriptionController
├── MatchingController
├── TailoringController
├── SuggestionController
├── ATSController
├── PDFController
├── SharingController
├── UsageController
├── BillingController
└── WebhookController
```

Services:

```text
ResumeService
ImportService
VersionService
JobDescriptionService
MatchingService
TailoringService
SuggestionService
ATSService
PDFService
SharingService
UsageService
BillingService
```

Infrastructure:

```text
MongoRepository
R2Storage
AIService
EmailService
PaymentProvider
JobQueue
```

---

# 116. Final API Architecture

The final flow is:

```text
                         Browser
                            │
                            ▼
                     Next.js Frontend
                            │
                      HTTPS / JSON
                            │
                            ▼
                    ┌────────────────┐
                    │ Express API    │
                    │ /api/v1        │
                    └───────┬────────┘
                            │
       ┌────────────────────┼───────────────────────────┐
       │                    │                           │
       ▼                    ▼                           ▼
 Authentication       Business Services            Validation
 Better Auth                │
                            │
             ┌──────────────┼────────────────────┐
             │              │                    │
             ▼              ▼                    ▼
          MongoDB          AI Layer              R2
             │              │                    │
             │        ┌─────┼─────┐              │
             │        ▼     ▼     ▼              │
             │      OpenAI Gemini Claude         │
             │                                   │
             └──────────────┬────────────────────┘
                            │
                            ▼
                     Background Worker
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Parsing          AI             PDF
```

The key principle is:

```text
Client
  ↓
API
  ↓
Domain Service
  ↓
Validated Operation
  ↓
Persistence / Job
```

The frontend never directly controls:

- AI providers
- MongoDB
- R2
- Usage limits
- Billing state
- Version integrity

The Express API remains the central authority for all business operations.

---

# 117. Final API Design Principles

The MVP API follows these rules:

**1. RESTful and versioned**  
`/api/v1`

**2. Authentication through Better Auth**

**3. Authorization on every private resource**

**4. Controllers remain thin**

**5. Business logic lives in services**

**6. Database access lives behind repositories**

**7. Expensive operations are asynchronous**

**8. Idempotency protects expensive mutations**

**9. AI outputs are untrusted until validated**

**10. AI proposes; the user approves**

**11. Quota is enforced server-side**

**12. Original/base resumes are protected**

**13. Historical versions are not silently overwritten**

**14. Public sharing uses a dedicated restricted DTO**

**15. Provider-specific infrastructure remains behind abstractions**

**16. The API contract is independent of OpenAI/Gemini/Claude, Stripe/Dodo, and other external providers**

This gives the MVP a clean API boundary while preserving the modular architecture needed for the later expansion of the product.