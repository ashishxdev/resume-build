# Resume Tailoring SaaS
## Database Design Document — MongoDB MVP v1.0

**Status:** Ready for implementation  
**Database:** MongoDB  
**Database Hosting:** MongoDB Atlas  
**Data Model:** Document-oriented with references between major domain entities  
**Primary principle:** Resume versions are immutable snapshots; AI outputs are proposals until accepted by the user.

---

# 1. Database Design Goals

The database must support the complete MVP workflow:

```text
User
 ↓
Resume
 ↓
Base Version
 ↓
Job Description
 ↓
Tailoring Session
 ↓
AI Suggestions
 ↓
Accepted Changes
 ↓
New Resume Version
 ↓
ATS Analysis
 ↓
PDF / Share
```

The database design should provide:

- Clear ownership of user data
- Immutable resume history
- Safe AI tailoring
- Evidence-based suggestions
- Usage/quota tracking
- Background job processing
- Secure share links
- Flexible resume structure
- Provider-independent AI metadata
- Future extensibility

---

# 2. Database Design Principles

## 2.1 MongoDB for flexible resume data

Resume structures differ between users.

One resume may contain:

- Projects
- Certifications
- Achievements

while another may contain:

- Publications
- Awards
- Volunteer experience

MongoDB allows the resume content to remain flexible without creating dozens of relational tables.

---

# 3. High-Level Collections

The application will use the following primary collections:

```text
users
resumes
resume_versions
files
job_descriptions
tailoring_sessions
suggestions
ats_analyses
share_links
usage_records
processing_jobs
subscriptions
idempotency_records
```

Better Auth will also create/manage the authentication-related collections required by its MongoDB configuration, such as accounts, sessions, and verification records.

---

# 4. Relationship Overview

Conceptually:

```text
User
│
├── Resumes
│    │
│    ├── Files
│    │
│    └── Resume Versions
│          │
│          ├── Job Description
│          ├── ATS Analysis
│          └── Share Link
│
├── Job Descriptions
│
├── Tailoring Sessions
│    │
│    └── Suggestions
│
├── Usage Records
│
├── Subscription
│
└── Processing Jobs
```

---

# 5. User / Authentication Data

## Collection

```text
users
```

This is primarily managed by Better Auth.

The application should avoid duplicating authentication state in another custom user collection.

Conceptually:

```json
{
  "_id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "emailVerified": true,
  "image": null,
  "createdAt": "2026-09-27T10:00:00Z",
  "updatedAt": "2026-09-27T10:00:00Z"
}
```

Application-specific plan information should ideally remain in the subscription/billing domain rather than turning the auth user document into the entire user profile.

---

# 6. Resume Collection

## Collection

```text
resumes
```

A `Resume` represents a logical resume owned by the user.

It is **not** the individual historical version.

Example:

```json
{
  "_id": "resume_123",
  "userId": "user_123",
  "name": "Software Engineer Resume",
  "baseVersionId": "version_001",
  "originalFileId": "file_001",
  "isDeleted": false,
  "createdAt": "2026-09-27T10:00:00Z",
  "updatedAt": "2026-09-27T10:15:00Z"
}
```

## Fields

| Field | Type | Purpose |
|---|---|---|
| `_id` | ObjectId/String | Resume ID |
| `userId` | String | Owner |
| `name` | String | User-defined resume name |
| `baseVersionId` | ObjectId | Original/base version |
| `originalFileId` | ObjectId | Uploaded source file |
| `isDeleted` | Boolean | Soft-delete support |
| `createdAt` | Date | Creation time |
| `updatedAt` | Date | Last modification |

---

# 7. Resume Ownership

Every resume must belong to exactly one user.

Logical invariant:

```text
resume.userId === authenticatedUser.id
```

No private resume API should rely solely on a resume ID.

Every query should include ownership authorization.

---

# 8. Resume Version Collection

## Collection

```text
resume_versions
```

This is the most important collection in the application.

Each version stores a complete snapshot of the resume.

Example:

```json
{
  "_id": "version_001",
  "resumeId": "resume_123",
  "name": "Original Resume",
  "versionNumber": 1,
  "versionType": "base",
  "sourceVersionId": null,
  "jobDescriptionId": null,

  "content": {
    "personalInfo": {},
    "summary": "",
    "experience": [],
    "education": [],
    "skills": [],
    "projects": [],
    "certifications": [],
    "achievements": [],
    "customSections": []
  },

  "design": {
    "pageSize": "A4",
    "orientation": "portrait",
    "typography": {},
    "spacing": {},
    "colors": {},
    "columns": {},
    "sectionOrdering": [],
    "layoutMetadata": {}
  },

  "createdAt": "2026-09-27T10:10:00Z",
  "updatedAt": "2026-09-27T10:10:00Z"
}
```

---

# 9. Version Type

`versionType` can be:

```text
base
tailored
manual
restored
duplicate
```

Example:

```text
Base Resume
    ↓
Tailored Version
    ↓
Manual Edits
```

The exact type can remain `tailored` while the edit history is represented through `sourceVersionId`.

---

# 10. Version Immutability

Historical versions should be treated as immutable snapshots.

The system should not do:

```text
v1 → overwrite v1
```

Instead:

```text
v1
 ↓
v2
```

For restore:

```text
v1
v2
v3
 ↓
restore v1
 ↓
v4 = copy of v1
```

This preserves history.

---

# 11. Why Store the Full Resume in Each Version?

We could normalize every experience, skill, project, and bullet into separate collections.

For this application, that would create unnecessary complexity.

Instead:

```text
ResumeVersion
    ↓
Complete Resume JSON
```

Benefits:

- Easy versioning
- Easy restore
- Simple PDF generation
- Simple public sharing
- Easy AI input
- Snapshot consistency
- No complicated joins

The same information is deliberately duplicated between versions because each version represents a complete historical state.

---

# 12. Resume Content Structure

The `content` object should have stable section structures.

```text
content
├── personalInfo
├── summary
├── experience[]
├── education[]
├── skills[]
├── projects[]
├── certifications[]
├── achievements[]
└── customSections[]
```

Every list item should have its own stable internal ID.

Example:

```json
{
  "id": "exp_01",
  "company": "ABC Technologies",
  "role": "Software Engineer",
  "bullets": [
    {
      "id": "bullet_01",
      "text": "Built APIs using Node.js and Express."
    }
  ]
}
```

Stable item IDs are important for AI suggestions.

---

# 13. Design Metadata

Each version contains design metadata.

Example:

```json
{
  "design": {
    "pageSize": "A4",
    "fontFamily": "Inter",
    "fontSize": 10,
    "lineHeight": 1.2,
    "sectionSpacing": 12,
    "primaryColor": "#111111",
    "columns": 1,
    "sectionOrdering": [
      "summary",
      "experience",
      "projects",
      "education",
      "skills"
    ]
  }
}
```

The exact structure can evolve as the renderer becomes more sophisticated.

---

# 14. Schema Versioning

Resume data should contain a schema version.

Example:

```json
{
  "schemaVersion": 1
}
```

This allows the application to migrate old resume versions later.

Example:

```text
schemaVersion 1
       ↓ migration
schemaVersion 2
```

This is especially useful when the resume model changes after launch.

---

# 15. Files Collection

## Collection

```text
files
```

MongoDB stores metadata; Cloudflare R2 stores actual binaries.

Example:

```json
{
  "_id": "file_001",
  "userId": "user_123",
  "resumeId": "resume_123",
  "type": "original_resume",
  "storageProvider": "cloudflare_r2",
  "objectKey": "users/user_123/resumes/resume_123/original/resume.pdf",
  "originalName": "resume.pdf",
  "mimeType": "application/pdf",
  "size": 245123,
  "status": "available",
  "createdAt": "2026-09-27T10:00:00Z"
}
```

## Types

Possible values:

```text
original_resume
generated_pdf
uploaded_image
uploaded_docx
```

---

# 16. File Status

```text
uploading
processing
available
failed
deleted
```

This allows the UI to understand processing state.

---

# 17. Job Description Collection

## Collection

```text
job_descriptions
```

The raw job description is always retained.

Example:

```json
{
  "_id": "jd_001",
  "userId": "user_123",
  "resumeId": "resume_123",

  "rawText": "We are looking for a frontend engineer...",

  "metadata": {
    "company": "Example Corp",
    "role": "Frontend Engineer"
  },

  "analysis": {
    "requiredSkills": [],
    "preferredSkills": [],
    "responsibilities": [],
    "keywords": [],
    "qualifications": [],
    "experienceRequirements": []
  },

  "analysisStatus": "completed",

  "createdAt": "2026-09-27T10:20:00Z",
  "updatedAt": "2026-09-27T10:20:10Z"
}
```

---

# 18. Job Description Analysis

The AI analysis is derived from `rawText`.

Therefore:

```text
rawText = source of truth

analysis = derived data
```

If the analysis is lost or becomes outdated, it can be regenerated.

---

# 19. Job Description Analysis Version

Recommended fields:

```text
analysisVersion
provider
model
promptVersion
analyzedAt
```

Example:

```json
{
  "analysisVersion": 1,
  "provider": "provider_x",
  "model": "model_y",
  "promptVersion": "jd-analysis-v1",
  "analyzedAt": "2026-09-27T10:20:10Z"
}
```

This becomes useful when we change AI prompts later.

---

# 20. Tailoring Sessions

## Collection

```text
tailoring_sessions
```

A tailoring session represents one AI tailoring workflow.

Example:

```json
{
  "_id": "tailor_001",
  "userId": "user_123",
  "resumeId": "resume_123",
  "baseVersionId": "version_001",
  "jobDescriptionId": "jd_001",
  "resultVersionId": null,

  "status": "review",

  "ai": {
    "provider": "provider_x",
    "model": "model_y",
    "promptVersion": "tailoring-v1"
  },

  "jobId": "job_123",

  "createdAt": "2026-09-27T10:21:00Z",
  "updatedAt": "2026-09-27T10:22:00Z"
}
```

---

# 21. Tailoring Session State

Recommended states:

```text
created
queued
analyzing
tailoring
review
completed
failed
cancelled
```

The session should not become `completed` until the resulting resume state is successfully saved.

---

# 22. Suggestions Collection

## Collection

```text
suggestions
```

Suggestions are deliberately separated from the tailoring session because they need independent querying and state transitions.

Example:

```json
{
  "_id": "suggestion_001",

  "tailoringSessionId": "tailor_001",
  "userId": "user_123",
  "resumeId": "resume_123",

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

  "reason": "Express is already present in the user's resume and is relevant to this role.",

  "evidence": [
    {
      "type": "skill",
      "source": "skills",
      "itemId": "skill_01",
      "value": "Express"
    }
  ],

  "status": "pending",

  "createdAt": "2026-09-27T10:22:00Z",
  "updatedAt": "2026-09-27T10:22:00Z"
}
```

---

# 23. Suggestion Status

```text
pending
accepted
rejected
```

Future states can include:

```text
superseded
expired
```

but they are not required for MVP.

---

# 24. Why Suggestions Need Evidence

The evidence field is central to the anti-fabrication system.

Example:

```text
Suggested:
"Built REST APIs using Node.js and Express."

Evidence:
Express → existing skill
Node.js → existing skill
API → existing experience
```

This gives us a way to validate the AI's proposal against known user information.

---

# 25. Suggestion Validation

Before an accepted suggestion is applied:

```text
Suggestion
    ↓
Target version exists?
    ↓
Target field exists?
    ↓
Suggestion still pending?
    ↓
Evidence valid?
    ↓
Apply change
```

If any critical condition fails, the suggestion should not be applied.

---

# 26. Accepted Suggestion Tracking

When accepted, store:

```json
{
  "status": "accepted",
  "acceptedAt": "2026-09-27T10:30:00Z"
}
```

Optionally:

```json
{
  "acceptedBy": "user_123"
}
```

This is useful for future analytics.

---

# 27. ATS Analysis Collection

## Collection

```text
ats_analyses
```

Example:

```json
{
  "_id": "ats_001",
  "userId": "user_123",
  "resumeId": "resume_123",
  "versionId": "version_002",
  "jobDescriptionId": "jd_001",

  "overallScore": 84,

  "categoryScores": {
    "keywordCoverage": 90,
    "skillAlignment": 88,
    "experienceRelevance": 80,
    "structure": 94,
    "formatting": 92
  },

  "deterministicFindings": [],
  "aiFindings": [],

  "analysisVersion": 1,

  "ai": {
    "provider": "provider_x",
    "model": "model_y",
    "promptVersion": "ats-v1"
  },

  "createdAt": "2026-09-27T10:35:00Z"
}
```

---

# 28. ATS Findings

Findings should be structured rather than a single block of text.

Example:

```json
{
  "type": "keyword",
  "severity": "medium",
  "title": "Keyword coverage could improve",
  "description": "The term REST API appears in the job description but is not explicitly represented in the resume.",
  "relatedKeyword": "REST API"
}
```

Possible severity:

```text
low
medium
high
```

---

# 29. Deterministic vs AI ATS Findings

Store them separately:

```text
deterministicFindings
aiFindings
```

This makes it possible to understand where a result originated.

Example:

```text
deterministic:
- Missing keyword: Docker

AI:
- Relevant backend experience could be emphasized more clearly
```

---

# 30. ATS Cacheability

An ATS analysis is associated with:

```text
versionId + jobDescriptionId
```

If neither changes, the existing analysis can be reused.

Conceptually:

```text
same version
+
same JD
=
reuse existing ATS analysis
```

This avoids unnecessary AI costs.

---

# 31. Share Links Collection

## Collection

```text
share_links
```

Example:

```json
{
  "_id": "share_001",
  "userId": "user_123",
  "resumeId": "resume_123",
  "versionId": "version_002",

  "tokenHash": "hashed-token",

  "enabled": true,

  "createdAt": "2026-09-27T11:00:00Z",
  "updatedAt": "2026-09-27T11:00:00Z"
}
```

---

# 32. Share Token Design

The actual token should be randomly generated.

Example URL:

```text
https://app.example.com/r/9f84d2f7c...
```

The database should preferably store:

```text
tokenHash
```

rather than the raw token.

The visitor supplies the raw token, which the application hashes and looks up.

---

# 33. Share Link Rules

A share link points to one exact version:

```text
shareLink.versionId
```

It should not automatically point to the user's latest resume.

This prevents an old shared resume from changing unexpectedly.

---

# 34. Disabling Sharing

Set:

```text
enabled = false
```

The application must reject future public access immediately.

Re-enabling can restore the same link unless the user regenerates it.

---

# 35. Regenerating a Share Link

When regenerated:

```text
old token → invalid
new token → active
```

The old share record can be disabled or replaced.

---

# 36. Usage Records

## Collection

```text
usage_records
```

This collection acts as the usage ledger.

Example:

```json
{
  "_id": "usage_001",
  "userId": "user_123",
  "type": "tailor_generation",

  "quantity": 1,

  "period": {
    "start": "2026-09-01T00:00:00Z",
    "end": "2026-10-01T00:00:00Z"
  },

  "referenceId": "tailor_001",

  "status": "consumed",

  "createdAt": "2026-09-27T10:22:00Z"
}
```

---

# 37. Usage States

To handle concurrent generation requests safely:

```text
reserved
consumed
released
```

Flow:

```text
Request
 ↓
Reserve quota
 ↓
AI processing
 ↓
Success → consumed
Failure → released
```

This is safer than simply incrementing a counter at request time.

---

# 38. Free and Pro Limits

Plan configuration:

```text
Free:
2 successful tailoring generations

Pro:
30 successful tailoring generations / billing period
```

The database should not hard-code these values into every usage record.

Plan limits should come from a plan configuration/service.

---

# 39. Subscription Collection

## Collection

```text
subscriptions
```

Payment provider is not finalized, so the database should remain provider-neutral.

Example:

```json
{
  "_id": "subscription_001",

  "userId": "user_123",

  "plan": "pro",

  "status": "active",

  "provider": "stripe",

  "providerCustomerId": "customer_123",
  "providerSubscriptionId": "subscription_123",

  "currentPeriodStart": "2026-09-01T00:00:00Z",
  "currentPeriodEnd": "2026-10-01T00:00:00Z",

  "cancelAtPeriodEnd": false,

  "createdAt": "2026-09-01T00:00:00Z",
  "updatedAt": "2026-09-27T10:00:00Z"
}
```

The provider could later be:

```text
stripe
dodo
another_provider
```

without changing the domain model substantially.

---

# 40. Subscription as Application Source of Truth

The payment provider is an external system.

Our database should maintain the application's canonical subscription state.

```text
Payment Provider
      ↓ webhook
Billing Service
      ↓
MongoDB Subscription
```

The frontend should read plan state from our application.

---

# 41. Processing Jobs Collection

## Collection

```text
processing_jobs
```

This supports the MongoDB-backed background processing architecture.

Example:

```json
{
  "_id": "job_001",

  "type": "resume_parsing",

  "userId": "user_123",

  "status": "processing",

  "payload": {
    "fileId": "file_001",
    "resumeId": "resume_123"
  },

  "attempts": 1,
  "maxAttempts": 3,

  "error": null,

  "createdAt": "2026-09-27T10:01:00Z",
  "startedAt": "2026-09-27T10:01:05Z",
  "completedAt": null
}
```

---

# 42. Processing Job Types

Examples:

```text
resume_parsing
image_processing
job_analysis
resume_matching
resume_tailoring
ats_analysis
ats_improvement
pdf_generation
```

---

# 43. Processing Job State

```text
queued
processing
completed
failed
cancelled
```

A retryable failure should increase:

```text
attempts
```

and return the job to:

```text
queued
```

until the maximum retry count is reached.

---

# 44. Idempotency Records

## Collection

```text
idempotency_records
```

Used to protect operations such as:

- Tailoring generation
- Payment requests
- Accept-all
- PDF generation

Example:

```json
{
  "_id": "idem_001",
  "userId": "user_123",
  "key": "client-generated-key",
  "operation": "tailoring",
  "requestHash": "hash",
  "response": {
    "tailoringSessionId": "tailor_001"
  },
  "createdAt": "2026-09-27T10:21:00Z",
  "expiresAt": "2026-09-28T10:21:00Z"
}
```

A TTL index can remove expired idempotency records.

---

# 45. Better Auth Collections

Better Auth is responsible for authentication-specific collections.

Conceptually these may include:

```text
users
sessions
accounts
verifications
```

The exact Better Auth schema should be generated by the Better Auth configuration rather than manually recreated by our domain layer.

The application should use Better Auth APIs/services rather than directly manipulating session records.

---

# 46. Collection Relationship Diagram

```text
users
 │
 ├──────────────┐
 │              │
 ▼              ▼
resumes      subscriptions
 │
 ├───────────────┐
 │               │
 ▼               ▼
files      resume_versions
               │
      ┌────────┼─────────────┐
      │        │             │
      ▼        ▼             ▼
job_descriptions  ats_analyses  share_links
      │
      ▼
tailoring_sessions
      │
      ▼
suggestions

users
  │
  ├── usage_records
  ├── processing_jobs
  └── idempotency_records
```

---

# 47. Important Referential Rules

## Resume

Must reference an existing:

```text
user
```

## ResumeVersion

Must reference an existing:

```text
resume
```

## JobDescription

Must reference an existing:

```text
user
resume
```

## TailoringSession

Must reference:

```text
user
resume
baseVersion
jobDescription
```

## Suggestion

Must reference:

```text
tailoringSession
target version
```

## ATSAnalysis

Must reference:

```text
version
jobDescription
```

## ShareLink

Must reference:

```text
version
```

---

# 48. Ownership Enforcement

The database schema alone does not provide the full security boundary.

The API must verify ownership.

Example:

```text
Suggestion
 ↓
TailoringSession
 ↓
Resume
 ↓
User
```

Before returning the suggestion, verify that the authenticated user owns the parent resume.

---

# 49. Denormalization Strategy

MongoDB allows controlled denormalization.

For example, suggestions can include:

```text
userId
resumeId
tailoringSessionId
```

even though these can theoretically be derived through relationships.

This is intentional.

Benefits:

- Faster queries
- Easier authorization
- Simpler indexes
- Less lookup overhead

The parent relationships remain the source of truth.

---

# 50. Resume Version Query Pattern

Most common query:

```text
Find versions for resume X
ordered by newest first
```

Index:

```text
{
  resumeId: 1,
  createdAt: -1
}
```

---

# 51. Resume Dashboard Query Pattern

Most common query:

```text
Find user's resumes
ordered by recently updated
```

Index:

```text
{
  userId: 1,
  updatedAt: -1
}
```

---

# 52. Suggestions Query Pattern

Most common:

```text
Find all pending suggestions
for tailoringSession X
```

Index:

```text
{
  tailoringSessionId: 1,
  status: 1
}
```

---

# 53. Share Link Query

Most common:

```text
Find share link by token hash
```

Index:

```text
{
  tokenHash: 1
}
```

with uniqueness enforced.

---

# 54. Processing Job Query

Worker needs:

```text
Find queued jobs
ordered by creation time
```

Index:

```text
{
  status: 1,
  createdAt: 1
}
```

---

# 55. Usage Query

Common:

```text
Find user tailoring usage
for current billing period
```

Index:

```text
{
  userId: 1,
  type: 1,
  "period.start": 1
}
```

The exact usage query can later be optimized using a billing-period identifier.

---

# 56. Subscription Query

Common:

```text
Find active subscription for user
```

Index:

```text
{
  userId: 1,
  status: 1
}
```

---

# 57. TTL Indexes

Useful for temporary data:

## Idempotency records

Expire automatically after their retention period.

## Potential job cleanup

Old completed processing jobs can eventually be removed.

## Temporary verification data

Handled primarily by Better Auth where applicable.

Permanent business records such as resumes and versions should not use TTL expiration.

---

# 58. Resume Deletion

Recommended MVP approach:

Use soft deletion at the logical `Resume` level:

```text
isDeleted = true
```

This makes accidental recovery possible.

Associated resources can later be permanently cleaned up asynchronously.

---

# 59. Delete Flow

```text
User deletes Resume
       ↓
Authorization
       ↓
Resume.isDeleted = true
       ↓
Disable share links
       ↓
Queue cleanup job
       ↓
Delete/retain associated files according to retention policy
```

The exact permanent-retention period can be defined later.

---

# 60. Version Deletion

Deleting a version requires additional checks.

The application must not allow deletion of the only active/base version unless business rules explicitly permit replacing it.

Before deleting:

```text
Check share links
Check references
Check whether base version
Check whether current version
```

---

# 61. Share Link + Version Integrity

If a version is permanently deleted:

```text
shareLinks.versionId
```

must not remain active.

Preferred behavior:

```text
Delete Version
 ↓
Disable associated shares
```

before or as part of cleanup.

---

# 62. Job Description Retention

Job descriptions are useful for version history and re-analysis.

They should remain associated with tailoring sessions even after a user edits the resume later.

This allows the application to answer:

> “Which job was this version tailored for?”

---

# 63. Tailoring Session + Version Relationship

A tailoring session may initially have:

```text
resultVersionId = null
```

while AI processing is happening.

After successful completion:

```text
resultVersionId = version_002
```

This makes the workflow explicit.

---

# 64. AI Metadata

AI-derived records should capture enough metadata to reproduce/debug behavior.

Recommended fields:

```text
provider
model
promptVersion
schemaVersion
requestId
startedAt
completedAt
durationMs
tokenUsage
```

Token usage can be optional depending on provider availability.

---

# 65. Prompt Versioning

Every AI-derived collection should be able to record a prompt version.

Examples:

```text
resume-parser-v1
jd-analysis-v1
matching-v1
tailoring-v1
ats-v1
ats-improvement-v1
```

This enables comparison when prompts are upgraded.

---

# 66. AI Provider Neutrality

The database should store:

```text
provider
model
```

but domain logic must not depend on values such as:

```text
openai-specific-field
gemini-specific-field
```

Provider-specific information belongs under an optional metadata object.

---

# 67. Resume Source Evidence

For anti-fabrication validation, source references should identify where information originated.

Example:

```json
{
  "type": "experience",
  "itemId": "exp_01",
  "subItemId": "bullet_01"
}
```

or:

```json
{
  "type": "skill",
  "itemId": "skill_03"
}
```

This provides a durable link between:

```text
Suggestion
      ↓
Resume evidence
```

---

# 68. Evidence Must Survive Versioning

A suggestion should reference the version against which it was generated.

Example:

```text
suggestion.target.versionId = version_001
```

If the user changes the version significantly afterward, the application should not blindly apply an old suggestion.

The system should detect version mismatch and mark the suggestion as stale/superseded where necessary.

---

# 69. Version Optimistic Concurrency

Resume versions should optionally include:

```text
revision
```

Example:

```json
{
  "revision": 12
}
```

A PATCH can specify:

```text
expectedRevision = 12
```

If the database is already at:

```text
revision = 13
```

the API can reject the stale update.

This protects against concurrent editing.

---

# 70. Recommended Core Schema Fields

Most domain collections should include:

```text
_id
createdAt
updatedAt
```

Where useful:

```text
deletedAt
schemaVersion
```

AI-derived documents should additionally include:

```text
analysisVersion
provider
model
promptVersion
```

---

# 71. Database Transactions

MongoDB transactions should be used only for operations requiring multiple-document atomicity.

Good candidates:

### Accept-all suggestions

```text
apply changes
+
update suggestion statuses
```

### Usage reservation

```text
reserve quota
+
create generation record
```

### Billing transition

```text
subscription update
+
related billing state
```

Avoid using transactions for every normal CRUD operation.

---

# 72. Atomic Usage Protection

The generation quota must be protected from concurrent requests.

Example:

```text
Free user has 1 generation remaining

Request A → attempts generation
Request B → attempts generation
```

We must not allow:

```text
A → sees 1
B → sees 1
A → consumes
B → consumes
```

The application should use an atomic reservation mechanism.

Result:

```text
A → reserves
B → rejected
```

---

# 73. Database Source of Truth

## Source of truth

### Resume content

```text
resume_versions.content
```

### Original file

```text
R2
```

with metadata in:

```text
files
```

### Job description

```text
job_descriptions.rawText
```

### AI suggestions

```text
suggestions
```

### ATS result

```text
ats_analyses
```

### User subscription

```text
subscriptions
```

### Usage

```text
usage_records
```

---

# 74. Derived Data

These are derived and can be regenerated:

```text
job_descriptions.analysis
ats_analyses
AI suggestions
generated PDFs
match analysis
```

This distinction is important for future migrations and cache invalidation.

---

# 75. Data Flow Through the Database

## Resume import

```text
files
   ↓
processing_jobs
   ↓
resume parsing
   ↓
resumes
   ↓
resume_versions
```

## Tailoring

```text
job_descriptions
        +
resume_versions
        ↓
tailoring_sessions
        ↓
processing_jobs
        ↓
suggestions
        ↓
new resume_version
```

## ATS

```text
resume_version
+
job_description
       ↓
ats_analysis
```

## Sharing

```text
resume_version
       ↓
share_link
       ↓
public access
```

---

# 76. Recommended Naming Conventions

MongoDB collection names:

```text
plural
snake_case
```

Examples:

```text
resume_versions
job_descriptions
tailoring_sessions
ats_analyses
share_links
usage_records
processing_jobs
```

Application TypeScript models can use:

```text
PascalCase
```

Example:

```text
ResumeVersion
JobDescription
TailoringSession
ATSAnalysis
```

---

# 77. Example Complete User Data Structure

Conceptually:

```text
User: user_123

├── Resume: resume_123
│   │
│   ├── File: original.pdf
│   │
│   ├── Version 1: Original
│   │
│   ├── Version 2: Google Tailored
│   │      │
│   │      ├── Job Description: jd_001
│   │      ├── Tailoring Session: tailor_001
│   │      ├── Suggestions
│   │      └── ATS Analysis
│   │
│   └── Version 3: Startup Tailored
│
├── Usage Records
│
├── Subscription
│
└── Processing Jobs
```

---

# 78. Database Design Invariants

These rules must always remain true.

## Invariant 1

Every resume belongs to exactly one user.

## Invariant 2

Every resume version belongs to exactly one resume.

## Invariant 3

The original/base resume is never overwritten by AI tailoring.

## Invariant 4

A suggestion belongs to one tailoring session.

## Invariant 5

A suggestion targets a specific resume version.

## Invariant 6

A share link points to one specific version.

## Invariant 7

A disabled share link cannot expose the resume.

## Invariant 8

A failed generation does not permanently consume a generation.

## Invariant 9

Historical versions remain available unless explicitly deleted.

## Invariant 10

AI-generated factual changes must have an evidence path where applicable.

---

# 79. MVP Database Collection Summary

| Collection | Purpose |
|---|---|
| `users` | Better Auth user identity |
| `resumes` | Logical resume container |
| `resume_versions` | Complete immutable resume snapshots |
| `files` | File metadata for R2 objects |
| `job_descriptions` | Raw JDs + derived analysis |
| `tailoring_sessions` | AI tailoring workflow |
| `suggestions` | AI proposed changes |
| `ats_analyses` | ATS compatibility results |
| `share_links` | Private-by-link sharing |
| `usage_records` | AI generation usage ledger |
| `processing_jobs` | Background processing |
| `subscriptions` | Provider-neutral Pro subscription state |
| `idempotency_records` | Duplicate-request protection |

---

# 80. Final Database Architecture

The central design is:

```text
                           USER
                            │
            ┌───────────────┼────────────────┐
            │               │                │
            ▼               ▼                ▼
         RESUMES       SUBSCRIPTION      USAGE
            │
            ▼
      RESUME VERSIONS
            │
     ┌──────┼───────────────┐
     │      │               │
     ▼      ▼               ▼
   JOB     ATS            SHARE
   DESC   ANALYSIS        LINK
     │
     ▼
TAILORING SESSION
     │
     ▼
SUGGESTIONS
     │
     ▼
ACCEPT / REJECT
     │
     ▼
NEW RESUME VERSION
```

And externally:

```text
                    MongoDB Atlas
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
  Domain Data      Processing Jobs      Usage/Billing
       │
       │
       ├───────────────► Cloudflare R2
       │                    │
       │                    ├── Original Files
       │                    └── Generated PDFs
       │
       ├───────────────► AI Provider Layer
       │
       └───────────────► Resend / Payment Provider
```

---

# 81. Final Database Design Principle

The most important decision is that **the resume itself is not a single mutable document**.

Instead:

```text
Resume
   ↓
Versions
   ↓
Each version = complete snapshot
```

AI operates on a verified version:

```text
Resume Version
      ↓
Job Description
      ↓
AI
      ↓
Suggestions
      ↓
Validation
      ↓
User Accept/Reject
      ↓
New Resume Version
```

This makes the database naturally support the product's most important requirements:

**No accidental overwriting, complete history, controlled AI changes, evidence-based suggestions, reliable sharing, reproducible ATS analysis, and a clean path for future features.**