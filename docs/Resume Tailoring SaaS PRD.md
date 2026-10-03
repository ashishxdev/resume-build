# Resume Tailoring SaaS
## Product Requirements Document — MVP v1.0

**Status:** Ready for development  
**Product type:** SaaS web application  
**Primary goal:** Help job seekers tailor an existing resume to a specific job description without fabricating information.

---

# 1. Product Overview

The product is an AI-powered resume tailoring platform.

Users upload an existing resume, provide a job description, and receive a tailored version of their resume optimized for that specific role.

The product combines:

- Resume parsing
- Structured resume editing
- Job-description analysis
- Resume/job matching
- Evidence-based AI rewriting
- ATS-oriented analysis
- AI improvement suggestions
- Manual editing
- Resume version history
- PDF generation
- Private resume sharing

The product is explicitly **not** intended to invent qualifications simply to increase job-description similarity.

## Core product promise

> **Make your existing experience more relevant to the job without making anything up.**

---

# 2. Problem

Job seekers frequently use one generic resume for multiple applications.

A job description may emphasize different:

- Skills
- Technologies
- Responsibilities
- Keywords
- Types of experience
- Qualifications

Manually tailoring a resume for every application is time-consuming.

Existing AI resume tools can also create a trust problem when they rewrite content by introducing skills, metrics, responsibilities, or experience that the candidate never provided.

This product addresses both problems by combining AI optimization with user control and evidence-based restrictions.

---

# 3. Goals

## Primary goals

1. Allow users to import an existing resume quickly.
2. Convert the resume into editable structured data.
3. Allow users to provide a job description.
4. Analyze the job description.
5. Compare the resume with the job description.
6. Generate an evidence-based tailored resume.
7. Show AI changes as suggestions.
8. Allow Accept/Reject control over AI changes.
9. Provide ATS-oriented analysis.
10. Allow users to improve the resume through additional suggestions.
11. Allow manual editing at any time.
12. Preserve the original resume.
13. Maintain versions of tailored resumes.
14. Export the final resume as PDF.
15. Allow private/unlisted resume sharing through a link.
16. Enforce free and Pro AI generation limits.

---

# 4. Non-Goals — MVP

The following are explicitly outside the MVP:

- Automatic job applications
- Job-board integrations
- LinkedIn integration
- Job searching
- Cover-letter generation
- Interview preparation
- Browser extension
- Automatic job URL scraping
- Application tracking/CRM
- Mobile application
- Resume template marketplace
- Team/company accounts
- Multiple public resume profiles
- AI job recommendations

These can be considered after the core resume-tailoring workflow is validated.

---

# 5. Target User

Primary user:

> Job seekers who already have a resume and are applying to multiple jobs.

Typical workflow:

```text
I have my resume
        ↓
I find a job
        ↓
I paste the job description
        ↓
I want to tailor my resume
        ↓
I want to know what I'm missing
        ↓
I want to improve the resume
        ↓
I want to review everything myself
        ↓
I download/send the resume
```

---

# 6. Product Principles

## 6.1 User owns the final resume

The AI assists the user. It does not control the final output.

The user can:

- Accept changes
- Reject changes
- Edit manually
- Restore previous versions

## 6.2 No fabrication

The AI must never introduce unsupported facts.

The system must not fabricate:

- Skills
- Technologies
- Companies
- Job titles
- Work experience
- Projects
- Certifications
- Achievements
- Metrics
- Responsibilities
- Education
- Credentials

## 6.3 Existing information can be optimized

The AI may:

- Reword existing content
- Reorganize existing content
- Improve clarity
- Improve grammar
- Improve relevance
- Change emphasis
- Improve keyword placement

provided the resulting statement remains supported by information supplied by the user.

## 6.4 Missing information remains missing

If a job description mentions a skill that does not exist in the user's provided information, the product must identify it as missing rather than inserting it into the resume.

---

# 7. User Journey

The primary MVP flow:

```text
Landing Page
    ↓
Signup / Login
    ↓
Dashboard
    ↓
Upload Resume
    ↓
Parse Resume
    ↓
Verify Structured Resume
    ↓
Resume Editor
    ↓
Add Job Description
    ↓
Analyze Job Description
    ↓
Resume ↔ Job Analysis
    ↓
Tailor Resume
    ↓
AI Suggestions
    ↓
Accept / Reject
    ↓
ATS Analysis
    ↓
Improve ATS
    ↓
Accept / Reject
    ↓
Manual Editing
    ↓
Save Version
    ↓
Download PDF / Share
```

---

# 8. Feature Requirements

# 8.1 Landing Page

## Purpose

Explain the product and convert visitors into users.

## Required sections

### Hero

Clearly communicate:

- What the product does
- AI resume tailoring
- No fabrication
- CTA

Example positioning:

> Tailor your resume for every job — without making anything up.

### How it works

```text
1. Upload your resume
2. Paste the job description
3. Tailor with AI
4. Review & improve
5. Download
```

### Feature section

Highlight:

- AI resume tailoring
- Job matching
- ATS analysis
- Missing keywords
- AI suggestions
- Resume editor
- Version history
- PDF export
- Private sharing

### Editor preview

Show the structured editor and live resume preview.

### Pricing

Show:

**Free**
- 2 AI-tailored resume generations

**Pro**
- 30 AI-tailored resume generations/month

### FAQ

Address:

- Does the AI invent experience?
- How does tailoring work?
- What file types are supported?
- What is the ATS score?
- Can I edit the generated resume?
- Can I share my resume?

---

# 8.2 Authentication

Authentication will use **Better Auth**.

Better Auth currently supports email/password authentication and social providers such as Google, integrates with Next.js, and provides a MongoDB adapter.

## Required authentication methods

### Email/password

- Sign up
- Login
- Logout
- Password reset
- Session management

### Google

- Continue with Google
- Login with Google
- Account linking where applicable

## Authentication requirements

Protected application routes must require an authenticated session.

Users must only be able to access their own resumes, versions, uploaded files, usage information, and private share configuration.

---

# 8.3 Dashboard

## Purpose

The dashboard is the user's central workspace.

## Dashboard content

### Summary

Display:

- Number of resumes
- Number of tailored versions
- Current plan
- AI generations used
- AI generations remaining

Example:

```text
Free Plan

1 / 2 tailored resumes generated
```

### Resume list

Each resume displays:

- Resume name
- Last updated
- Number of versions
- Original/tailored state
- Actions

Actions:

- Open
- Edit
- Tailor
- View history
- Share
- Download
- Delete

### Recent activity

Display recent:

- Tailorings
- Versions
- Resume edits

---

# 8.4 Resume Upload & Import

## Supported inputs

- PDF
- DOCX

Image/photo imports and OCR are intentionally outside the current product scope.

## Upload process

```text
Upload
  ↓
Validate file
  ↓
Extract content
  ↓
Parse resume
  ↓
Generate structured resume
  ↓
Show verification step
```

## Validation

System should validate:

- Supported format
- File size
- File readability
- Extraction success

If parsing fails, the user should receive an understandable error and a way to retry.

## Original file

The original uploaded file must be preserved.

It should never be overwritten by AI-generated versions.

---

# 8.5 Resume Parsing

The system converts uploaded content into structured resume data.

## Expected structure

```text
Resume
├── Personal Information
├── Summary
├── Experience[]
├── Education[]
├── Skills[]
├── Projects[]
├── Certifications[]
├── Achievements[]
└── Custom Sections[]
```

## Personal information

Possible fields:

- Full name
- Email
- Phone
- Location
- Website
- LinkedIn
- GitHub
- Other relevant links

## Experience

Each experience entry contains:

- Company
- Position
- Location
- Start date
- End date
- Current/previous
- Description/bullets

## Education

- Institution
- Degree
- Field
- Dates
- Grade/GPA where supplied

## Projects

- Project name
- Description
- Technologies
- Links
- Dates where supplied

## Skills

Skills should be represented as structured values where possible.

---

# 8.6 Resume Verification

Because automated parsing may make mistakes, users must be able to verify and correct the imported resume before tailoring.

The verification interface should make it obvious:

> “Review your resume information before using AI tailoring.”

User can:

- Edit
- Add
- Remove
- Correct
- Reorder

This corrected structured resume becomes the source of truth for AI tailoring.

---

# 8.7 Resume Editor

## Design

The editor uses:

**Structured editor + live preview**

rather than an unrestricted rich-text editor.

## Layout

Conceptually:

```text
┌──────────────────────┬────────────────────────┐
│ Resume Editor        │ Live Resume Preview    │
│                      │                        │
│ Personal Information │                        │
│ Summary              │        RESUME          │
│ Experience           │                        │
│ Education            │                        │
│ Skills               │                        │
│ Projects             │                        │
│ Certifications       │                        │
└──────────────────────┴────────────────────────┘
```

## Editor capabilities

Users can:

- Edit fields
- Add sections
- Remove sections
- Add experience
- Remove experience
- Reorder sections
- Reorder bullets
- Edit individual bullets
- Edit skills
- Edit projects
- Edit summary

## Autosave

Edits should be saved automatically.

The user should not need to manually save every field.

---

# 8.8 Existing Design Preservation

MVP does not provide a template marketplace.

The application should preserve the uploaded resume's design/layout as closely as reasonably possible.

This includes, where technically possible:

- Section ordering
- Typography
- Spacing
- Alignment
- Headings
- Layout
- Columns
- Visual hierarchy

Exact pixel-perfect reproduction is not guaranteed for arbitrary PDFs/images.

The product should prioritize:

1. Content correctness
2. Readability
3. Stable structured editing
4. High-fidelity visual reproduction

---

# 8.9 Job Description Input

## Input

Large text area for users to paste the complete job description.

## Job information

The system should store:

- Job description text
- Associated resume
- Creation date
- Tailoring operation
- Resulting version

Optional metadata may include:

- Company
- Job title

These fields can be extracted by AI but should remain editable by the user.

---

# 8.10 Job Description Analysis

When a JD is submitted, the AI analyzes it before tailoring.

## Extract

### Skills

- Technical skills
- Soft skills
- Tools
- Technologies
- Frameworks
- Platforms

### Requirements

- Education
- Experience
- Certifications
- Seniority

### Responsibilities

Identify major responsibilities.

### Keywords

Identify relevant terms and phrases.

### Priority

Where possible, categorize requirements:

```text
Required
Preferred
Contextual
```

The analysis should be informational and should not alter the resume.

---

# 8.11 Resume ↔ Job Matching

The application compares:

**Structured Resume**

against

**Structured Job Requirements**

## Match categories

### Matched

Information already supported by the user's resume.

### Missing

Important requirements not supported by the user's resume.

### Relevant but underrepresented

Information exists in the resume but is not emphasized effectively.

### Improvement opportunities

Content that may benefit from clearer wording or positioning.

## Example

```text
Job requires

React           ✓
Node.js         ✓
PostgreSQL      ✓
AWS             ⚠ Missing
Docker          ⚠ Missing
Redis           ⚠ Missing
```

Missing skills must not be added automatically.

---

# 8.12 AI Resume Tailoring

## Entry point

User selects:

> Tailor Resume

## Inputs

AI receives:

- Verified structured resume
- Job description
- JD analysis
- Matching information
- Missing information
- Existing resume content

## Output

AI generates a tailored resume proposal.

## Allowed transformations

AI may:

- Rewrite bullets
- Improve wording
- Improve grammar
- Improve clarity
- Increase relevance
- Reorder relevant content
- Improve summary
- Improve keyword placement
- Emphasize existing relevant experience
- Reduce irrelevant wording

## Forbidden transformations

AI must not:

- Invent skills
- Invent technologies
- Invent achievements
- Invent metrics
- Invent employers
- Invent responsibilities
- Invent job titles
- Invent projects
- Invent certifications
- Invent education
- Assume experience based solely on the job description

---

# 8.13 Evidence Model

The tailoring engine should conceptually treat the verified resume as its evidence base.

Every proposed factual statement should be traceable to existing user-provided information.

For example:

```text
User data
    ↓
Existing bullet:
"Built APIs with Node.js and Express."

JD:
"Build scalable REST APIs."

Allowed:
"Built REST APIs using Node.js and Express."

Not allowed:
"Built distributed AWS microservices."
```

The second statement introduces unsupported facts and must not be generated.

---

# 8.14 AI Suggestions

AI changes should be represented as individual suggestions.

## Suggestion structure

Each suggestion should contain:

- Section
- Original text
- Suggested text
- Reason
- Evidence/reference to existing information
- Status

Possible statuses:

```text
pending
accepted
rejected
```

## Example

```text
Experience

Current:
Built APIs using Node.js.

AI suggestion:
Built REST APIs using Node.js and Express.

Why:
Express is already included in the user's
existing resume and is relevant to the job.

[Accept] [Reject]
```

## Bulk actions

- Accept all
- Reject all

Users can also manually modify accepted suggestions afterward.

---

# 8.15 Tailored Resume Generation

When the user accepts changes, the system creates a new tailored version.

The original resume remains unchanged.

Example:

```text
Base Resume
     ↓
Tailoring Session
     ↓
Version 2
```

If the user tailors the same resume to another job:

```text
Base Resume
 ├── Google Version
 ├── Microsoft Version
 └── Startup Version
```

---

# 8.16 ATS Analysis

The application provides an ATS-oriented compatibility analysis.

## Important positioning

The product must not claim to reproduce the exact ATS score used by a particular company.

Instead, it should describe the score as an internal:

> **ATS Compatibility / Resume Match Score**

## Evaluation areas

Potential categories:

- Keyword coverage
- Skill coverage
- Job-description alignment
- Relevant experience
- Resume structure
- Section completeness
- Formatting compatibility
- Readability
- Keyword placement

## Example result

```text
ATS Compatibility

82 / 100

Keyword Coverage       88
Skill Alignment        84
Experience Relevance   78
Structure               94
Formatting              91
```

Each score should be accompanied by useful explanations where appropriate.

---

# 8.17 Improve ATS

## Entry point

User clicks:

> Improve ATS

## Process

```text
Current Resume
      ↓
ATS Analysis
      ↓
Problems detected
      ↓
AI suggestions
      ↓
Accept / Reject
```

## Examples

```text
Improve keyword placement
Rewrite unclear bullet
Make existing relevant experience clearer
Improve section consistency
Remove unnecessary formatting
```

## Missing skills

The feature must distinguish between:

**Can improve**

and

**Cannot invent**

Example:

```text
AWS

Not found in your resume.

We cannot add it automatically.
```

The system may recommend that the user manually add genuine experience if they have it.

---

# 8.18 Manual Editing

Manual editing remains available after every AI operation.

The user can:

- Change AI-generated wording
- Undo AI changes
- Add information
- Remove information
- Rearrange sections
- Modify formatting within supported editor controls

The AI should never lock the user into its output.

---

# 8.19 Version Management

Every significant tailored state should be stored separately.

## Version metadata

Each version should include:

- Version ID
- Resume ID
- Name
- Created timestamp
- Updated timestamp
- Source version
- Job description reference, where applicable
- Tailoring status
- ATS analysis snapshot, where applicable

## Version actions

- View
- Rename
- Edit
- Duplicate
- Restore
- Delete

## Original

The original imported resume should be treated as a protected baseline.

---

# 8.20 PDF Export

Users can export the current resume as PDF.

## Requirements

Generated PDF should:

- Match the current preview
- Preserve layout
- Preserve typography where supported
- Preserve spacing
- Contain only the intended resume content
- Be suitable for job applications

PDF export should happen from the structured resume representation rather than screenshotting the editor.

---

# 8.21 Public Resume Sharing

Users can generate a private-by-link resume URL.

Example:

```text
app.com/r/unique-token
```

## Public page

Contains:

- Resume
- Download PDF button

## Privacy

Public resumes are:

- Unlisted
- Not displayed in a public resume directory
- Accessible to people who possess the link
- Not intended to be indexed by search engines

The application should use appropriate `noindex` behavior and avoid exposing share URLs through public listings.

## User controls

- Create share link
- Enable/disable sharing
- Regenerate link

Disabling a share link must immediately invalidate public access.

---

# 8.22 Usage & Plans

## Free plan

Users can generate:

> **2 AI-tailored resumes**

An AI-tailored resume means a completed resume generation based on a job description.

Uploading/importing the original resume does not consume this allowance.

## Pro plan

Users can generate:

> **30 AI-tailored resumes per month**

## Usage display

Dashboard should show:

```text
Pro Plan

12 / 30 generations used
18 remaining
```

## Important MVP rule

The quota is tied to successful AI tailoring generations, not to the number of times a user manually edits the resume.

ATS analysis and suggestion processing within the same tailoring workflow should not independently consume an additional resume-generation credit.

A failed generation should not consume a credit.

---

# 8.23 AI Provider Abstraction

The application must not make the business logic dependent on one LLM vendor.

## Architecture

```text
Application
      ↓
AI Service Layer
      ↓
Provider Interface
      ↓
Provider Adapter
 ┌────────┬────────┬────────┐
 │OpenAI  │Gemini  │Claude  │
 └────────┴────────┴────────┘
```

## AI service responsibilities

The application should have separate logical capabilities for:

- Resume parsing
- JD parsing
- Resume/JD matching
- Resume tailoring
- Suggestion generation
- ATS analysis
- ATS improvement

The provider can be changed without rewriting the surrounding product logic.

---

# 9. Core Screens

The MVP should contain these primary screens.

## Public

### `/`
Landing page

### `/login`
Login

### `/signup`
Signup

---

## Authenticated

### `/dashboard`
Dashboard

### `/resumes`
Resume management

### `/resumes/:id`
Resume workspace/editor

### `/resumes/:id/tailor`
Job description + tailoring workflow

### `/resumes/:id/versions`
Version history

### `/resumes/:id/versions/:versionId`
Specific version/editor

### `/settings`
Account and plan settings

---

## Public sharing

### `/r/:shareToken`
Private-by-link public resume

---

# 10. Resume Workspace

The workspace is the most important application screen.

Recommended structure:

```text
┌───────────────────────────────────────────────────┐
│ Header                                            │
├───────────────────────┬───────────────────────────┤
│                       │                           │
│ Editor                │ Resume Preview            │
│                       │                           │
│ Summary               │                           │
│ Experience            │                           │
│ Education             │                           │
│ Skills                │                           │
│ Projects              │                           │
│                       │                           │
│ [AI Suggestions]      │                           │
│                       │                           │
└───────────────────────┴───────────────────────────┘
```

Potential top-level actions:

- Tailor
- ATS Analysis
- Improve ATS
- History
- Download
- Share

---

# 11. Data Model — High Level

MongoDB will be used as the primary application database.

## User

```text
User
- id
- name
- email
- image
- plan
- usage
- createdAt
- updatedAt
```

Better Auth manages its required authentication/session/account data through its configured database integration.

## Resume

```text
Resume
- id
- userId
- name
- originalFileId
- structuredContent
- designMetadata
- createdAt
- updatedAt
```

## ResumeVersion

```text
ResumeVersion
- id
- resumeId
- name
- content
- sourceVersionId
- jobDescriptionId
- generationMetadata
- createdAt
- updatedAt
```

## JobDescription

```text
JobDescription
- id
- userId
- resumeId
- rawText
- company
- role
- analysis
- createdAt
```

## TailoringSession

```text
TailoringSession
- id
- userId
- resumeId
- baseVersionId
- jobDescriptionId
- resultVersionId
- suggestions
- status
- provider
- model
- createdAt
```

## ATSAnalysis

```text
ATSAnalysis
- id
- versionId
- overallScore
- categoryScores
- findings
- createdAt
```

## ShareLink

```text
ShareLink
- id
- resumeVersionId
- token
- enabled
- createdAt
- expiresAt
```

## UsageRecord

```text
UsageRecord
- id
- userId
- type
- amount
- period
- createdAt
```

---

# 12. File Storage

Cloudflare R2 will be used for uploaded and generated files.

Potential objects include:

```text
/users/{userId}/resumes/original/{file}
```

```text
/users/{userId}/resumes/generated/{versionId}.pdf
```

Files should not be publicly exposed directly through permanent storage URLs.

The application should generate controlled access URLs or serve them through authorized endpoints where appropriate.

---

# 13. API / Service Areas

The backend should expose logical API/service areas for:

## Authentication

Handled through Better Auth.

## Resume

```text
POST   /api/resumes
GET    /api/resumes
GET    /api/resumes/:id
PATCH  /api/resumes/:id
DELETE /api/resumes/:id
```

## Upload

```text
POST /api/resumes/upload
```

## Versions

```text
GET    /api/resumes/:id/versions
POST   /api/resumes/:id/versions
GET    /api/versions/:id
PATCH  /api/versions/:id
DELETE /api/versions/:id
```

## Job descriptions

```text
POST /api/job-descriptions
GET  /api/job-descriptions/:id
```

## Analysis

```text
POST /api/job-descriptions/:id/analyze
POST /api/match
```

## Tailoring

```text
POST /api/tailor
```

## Suggestions

```text
GET   /api/tailor/:id/suggestions
PATCH /api/suggestions/:id
POST  /api/tailor/:id/accept-all
POST  /api/tailor/:id/reject-all
```

## ATS

```text
POST /api/ats/analyze
POST /api/ats/improve
```

## Export

```text
POST /api/versions/:id/export
GET  /api/versions/:id/download
```

## Sharing

```text
POST   /api/versions/:id/share
PATCH  /api/share/:token
DELETE /api/share/:token
```

These represent logical boundaries; final endpoint design can be refined during implementation.

---

# 14. AI Output Contracts

AI responses should use structured outputs rather than relying on free-form text.

## Resume parser output

```text
{
  personalInfo: {},
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  achievements: [],
  customSections: []
}
```

## JD analysis output

```text
{
  role: "",
  company: "",
  requiredSkills: [],
  preferredSkills: [],
  responsibilities: [],
  keywords: [],
  qualifications: [],
  experienceRequirements: []
}
```

## Suggestion output

```text
{
  section: "",
  itemId: "",
  originalText: "",
  suggestedText: "",
  reason: "",
  evidence: [],
  status: "pending"
}
```

Structured outputs reduce ambiguity and make the AI layer easier to validate.

---

# 15. AI Safety / Validation Layer

The application should not rely solely on an instruction such as:

> “Don't hallucinate.”

There should be multiple layers of validation.

## Layer 1 — Input grounding

Provide only verified user resume data as factual source material.

## Layer 2 — AI instruction

Tell the model explicitly:

> You may only use information supported by the provided resume. Never introduce unsupported facts.

## Layer 3 — Structured output

Require the AI to identify source/evidence for factual changes.

## Layer 4 — Application validation

Validate suggestions against available source data where possible.

## Layer 5 — User review

Require user acceptance before committing AI suggestions.

The final system should be designed so that the AI's output is treated as a **proposal**, not automatically trusted as truth.

---

# 16. Error States

The MVP must handle:

## Invalid file

Display:

> This file type isn't supported.

## File too large

Display:

> This file is too large to upload.

## Resume parsing failure

Display:

> We couldn't reliably read this resume. Please try another file.

## Empty job description

Display:

> Add a job description to start tailoring.

## AI failure

Display:

> We couldn't generate your tailored resume. Please try again.

The failed operation must not consume a generation credit.

## Rate limit

Display:

> You've reached your current AI generation limit.

Provide an appropriate Pro upgrade path for Free users.

## Share disabled

Public link should return an unavailable state when sharing has been disabled.

---

# 17. Security & Privacy

Because resumes contain personally identifiable information, privacy is a core requirement.

## Requirements

- Users can only access their own private data.
- Resume files must not be publicly accessible by default.
- Public share links expose only the selected resume version.
- Disabled links immediately stop public access.
- API endpoints must enforce ownership.
- Authentication must be required for private application routes.
- Sensitive secrets must remain server-side.
- AI provider credentials must never be exposed to the client.
- Uploaded files should use secure storage access patterns.
- Delete operations should remove associated stored files where applicable.

---

# 18. AI Data Handling

The product should clearly explain how user resume information is processed by AI providers.

The implementation should support provider-specific configuration so that AI processing can be changed without changing product logic.

The application should avoid sending unnecessary user data to AI providers.

For every AI request, send only the information needed for that operation.

---

# 19. Performance Requirements

The product should feel responsive even when AI operations are asynchronous.

For long operations:

```text
Queued
   ↓
Processing
   ↓
Completed
```

The UI should not appear frozen while:

- Parsing a resume
- Analyzing a JD
- Generating suggestions
- Running ATS analysis
- Generating PDFs

The architecture should support background processing for operations that become too expensive or slow for a normal request/response cycle.

---

# 20. Versioning Rules

The system should distinguish between:

### Base resume

The user's original editable resume.

### Tailored version

A job-specific version derived from the base or another version.

### Manual edits

Changes the user makes after AI generation.

### AI suggestions

Proposed changes awaiting acceptance.

The application should never unexpectedly overwrite the user's base resume when tailoring another job.

---

# 21. Core Acceptance Criteria

## Resume upload

A user can upload PDF or DOCX files and receive a structured resume representation. Image files are rejected.

## Resume verification

A user can correct parsed information before AI tailoring.

## Job description

A user can paste a JD and start analysis.

## Matching

The system identifies matching and missing information.

## Tailoring

A tailored resume is generated using only supported information from the user's resume.

## Fabrication prevention

Unsupported skills or experience from the JD are not inserted into the resume.

## Suggestions

AI-generated changes appear individually with Accept/Reject controls.

## Manual editing

The user can edit the final resume manually.

## ATS

The system produces an ATS-oriented compatibility analysis.

## Improve ATS

The user receives actionable improvement suggestions.

## Versioning

The original resume remains available after tailoring.

## PDF

A user can download the current resume as PDF.

## Sharing

A user can create an unlisted share link.

## Privacy

Disabling the link prevents further public access.

## Usage

Free users cannot generate more than 2 successful AI-tailored resumes.

Pro users cannot generate more than 30 successful AI-tailored resumes during a billing month.

---

# 22. MVP Success Metrics

The first version should primarily measure whether users are successfully completing the core workflow.

## Activation

Percentage of users who:

```text
Signup
  ↓
Upload resume
  ↓
Submit JD
  ↓
Generate tailored resume
```

## Completion

Percentage of tailoring sessions resulting in a saved version.

## AI suggestion interaction

Measure:

- Suggestions accepted
- Suggestions rejected
- Suggestions ignored

This will indicate whether users trust/use the AI recommendations.

## Export

Percentage of tailored resumes downloaded.

## Share

Percentage of users creating a share link.

## Retention

Users returning to tailor another resume for another job.

## Conversion

Free users upgrading to Pro.

---

# 23. Recommended MVP Build Order

## Phase 1 — Foundation

- Next.js application
- TypeScript
- Tailwind
- Node/Express backend
- MongoDB
- Cloudflare R2
- Better Auth
- Basic application layout

## Phase 2 — Resume foundation

- Upload
- File processing
- Parsing
- Structured resume model
- Verification
- Resume editor
- Live preview

## Phase 3 — AI workflow

- JD input
- JD analysis
- Resume/JD matching
- Tailoring
- Evidence validation
- Suggestions
- Accept/Reject

## Phase 4 — ATS

- ATS analysis
- Score breakdown
- Improve ATS
- ATS suggestions

## Phase 5 — Resume management

- Versions
- History
- Restore
- Duplicate
- Resume management

## Phase 6 — Output

- PDF generation
- Private share links

## Phase 7 — SaaS controls

- Free limits
- Pro limits
- Usage tracking
- Upgrade UI
- Settings

## Phase 8 — Polish

- Error states
- Loading states
- Empty states
- Responsive UI
- Security review
- AI validation
- Performance optimization

---

# 24. Technical Architecture

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
```

## Backend

```text
Node.js
Express
TypeScript
```

## Database

```text
MongoDB
```

## Authentication

```text
Better Auth
├── Email/password
└── Google OAuth
```

Better Auth's current documentation provides the required email/password and social authentication capabilities, Next.js integration, and MongoDB adapter.

## File storage

```text
Cloudflare R2
```

## AI

```text
Application
    ↓
AI abstraction layer
    ↓
Provider adapters
    ↓
LLM provider
```

## PDF

```text
Structured Resume JSON
       ↓
Resume Renderer
       ↓
PDF
```

---

# 25. Product Architecture Principle

The most important architectural separation is:

```text
Resume Data
     ↓
Resume Renderer
     ↓
Visual Resume

Resume Data
     ↓
AI Analysis
     ↓
Suggestions

Job Description
     ↓
JD Analyzer
     ↓
Job Requirements

Resume + Job Requirements
     ↓
Matching Engine
     ↓
Tailoring Engine
```

This prevents the UI, AI, and document rendering systems from becoming tightly coupled.

---

# 26. Future Expansion

The architecture should leave room for:

- More resume templates
- Cover letters
- Job application tracking
- Job URL import
- LinkedIn integration
- Job discovery
- Interview preparation
- Application analytics
- Multiple AI providers
- Team plans
- Browser extension
- DOCX export

These should not influence MVP scope unless they require architectural primitives that are inexpensive to support now.

---

# 27. MVP Definition of Done

The MVP is considered complete when a new user can successfully:

```text
1. Create an account
          ↓
2. Upload an existing resume
          ↓
3. Verify parsed resume information
          ↓
4. Edit the resume
          ↓
5. Paste a job description
          ↓
6. Analyze the job
          ↓
7. See matching/missing skills
          ↓
8. Generate a tailored resume
          ↓
9. Review AI suggestions
          ↓
10. Accept/reject suggestions
          ↓
11. Run ATS analysis
          ↓
12. Improve ATS
          ↓
13. Manually edit
          ↓
14. Save a version
          ↓
15. Download PDF
          ↓
16. Generate a private share link
```

The original resume must remain intact throughout the process.

---

# 28. Final Product Definition

This MVP is fundamentally a **resume optimization workspace**.

It is not:

> “Upload resume → AI rewrites it.”

It is:

```text
                 JOB DESCRIPTION
                        ↓
                  JD ANALYSIS
                        ↓
RESUME → STRUCTURE → MATCHING → AI TAILORING
                        ↓
                  AI SUGGESTIONS
                     ↙     ↘
                 ACCEPT    REJECT
                     ↓
                ATS ANALYSIS
                     ↓
                 IMPROVE ATS
                     ↓
                MANUAL EDITING
                     ↓
                VERSION HISTORY
                  ↙         ↘
             DOWNLOAD      SHARE
```

The differentiator is **controlled, evidence-based personalization** rather than unrestricted AI rewriting.
