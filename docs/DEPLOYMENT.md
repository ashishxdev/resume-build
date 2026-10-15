# Production Deployment

The recommended production topology uses three independently deployed
processes:

- `apps/web`: a Next.js project on Vercel;
- `apps/api`: an Express project on Vercel; and
- `apps/api` worker entrypoint: one always-on process on Railway, Render, or an equivalent service.

In the recommended topology, the Vercel API never runs queue polling loops.
Resume extraction, job analysis, tailoring generation, and ATS analysis run
only in the worker process.

For budget-constrained preview or hobby deployments, the API and worker can
instead run together in one Render Web Service through the `start:render`
entrypoint. This two-process topology consists of the Vercel web project plus
the combined Render service. A free Render service sleeps after inactivity, so
it is not the preferred production topology.

## 1. External services

Provision these before the final deployment:

- a MongoDB Atlas database and database user;
- a private Cloudflare R2 bucket with a bucket-scoped Object Read & Write
  token;
- a Resend API key and verified sending domain; and
- a Gemini API key.

Configure the R2 bucket for direct browser uploads. Replace the production
origin with the final web URL and keep localhost only if local uploads should
continue using the production bucket:

```json
[
  {
    "AllowedOrigins": [
      "https://app.example.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The R2 bucket remains private. Do not put R2 credentials or any other secret
in the web project.

## 2. Vercel web project

Import the repository as a Vercel project with:

- **Project name:** `make-my-resume-web`
- **Root directory:** `apps/web`
- **Application preset:** Next.js
- **Node.js:** 22.x
- **Include source files outside the root directory:** enabled
- **Build and output settings:** framework defaults

Set this production environment variable and redeploy whenever it changes:

```ini
NEXT_PUBLIC_API_URL=https://api.example.com
```

## 3. Vercel API project

Import the same repository a second time with:

- **Project name:** `make-my-resume-api`
- **Root directory:** `apps/api`
- **Application preset:** Express
- **Node.js:** 22.x
- **Include source files outside the root directory:** enabled
- **Build and output settings:** framework defaults

Vercel discovers `apps/api/src/index.ts`, which exports the Express app without
opening a listening port or starting background loops. The normal local API
command continues to use `apps/api/src/entrypoints/api.ts` and opens `PORT`.

Set these production variables in the API project:

```ini
NODE_ENV=production
LOG_LEVEL=info
WEB_ORIGIN=https://app.example.com

AUTH_STORAGE=mongodb
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/
MONGODB_DATABASE=make_my_resume

BETTER_AUTH_SECRET=GENERATE_WITH_OPENSSL_RAND_BASE64_32
BETTER_AUTH_URL=https://api.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://app.example.com
TRUSTED_PROXY_IPS=

R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=YOUR_PRIVATE_BUCKET_NAME

AI_PROVIDER=gemini
AI_PROVIDER_API_KEY=YOUR_GEMINI_API_KEY
AI_MODEL=gemini-3.1-flash-lite

RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=Make My Resume <auth@example.com>
EMAIL_REPLY_TO=support@example.com
PASSWORD_RECOVERY_ENABLED=false
```

Password recovery is temporarily paused in the UI and API. Leave
`PASSWORD_RECOVERY_ENABLED=false` (or omit it). Resend configuration is optional
while recovery is disabled. Restore the recovery pages and sign-in link and set
the flag to `true` only after verifying a sender domain in Resend.

Generate `BETTER_AUTH_SECRET` locally with:

```bash
openssl rand -base64 32
```

`R2_ENDPOINT` is optional; the API derives the standard endpoint from the
account ID. `BETTER_AUTH_API_KEY` is also optional and is required only for the
Better Auth Infrastructure dashboard integration. Do not add obsolete Google
OAuth or payment variables. Vercel provides its own port, so `PORT` is not
needed there.

The API trusts Vercel's edge-overwritten `x-vercel-forwarded-for` header only
when Vercel supplies `VERCEL=1`. Keep `TRUSTED_PROXY_IPS` empty on Vercel. Set
it only when another runtime is behind a known reverse proxy whose exact IPs or
CIDRs can be allowlisted.

## 4A. Always-on worker

Create one worker service from the same repository. Its working directory must
be the repository root so pnpm can resolve the workspace packages.

```text
Build command:
pnpm --filter @make-my-resume/api... build

Start command:
pnpm --filter @make-my-resume/api start:worker
```

Copy the complete API production environment into the worker. The worker uses
MongoDB, R2, and Gemini directly, and the shared production environment schema
also validates authentication and email configuration at startup. Start with
one worker replica.

Do not use Vercel Hobby Cron as a replacement for this process. The current
worker continuously claims durable queued jobs, renews leases, and recovers
abandoned work.

## 4B. Combined Render API and worker

For a free hobby deployment, create one Render **Web Service** from the same
repository and leave its root directory empty so pnpm can resolve the complete
workspace. Use one instance with:

```text
Build command:
pnpm install --frozen-lockfile && pnpm --filter @make-my-resume/api... build

Start command:
pnpm --filter @make-my-resume/api start:render

Health check path:
/health
```

The combined entrypoint binds Express to `0.0.0.0:$PORT` and starts the resume
extraction, job-description analysis, tailoring, and ATS loops in the same
process. Render supplies `PORT`; do not override it. Copy the complete API
production environment to the service, set `BETTER_AUTH_URL` to its public
Render origin, and point the web project's `NEXT_PUBLIC_API_URL` at the same
origin.

This mode replaces both the Vercel API project and the standalone worker; do
not run either of those at the same time. Free Render Web Services sleep after
inactivity and can take about a minute to wake. The first API request wakes the
service, queued jobs remain durable in MongoDB, and expired processing leases
are reclaimed after a restart. Use the separate always-on worker topology for
production availability.

## 5. Deployment order

1. Provision MongoDB, R2, Resend, and Gemini.
2. Choose either the separate Vercel API plus always-on worker topology or the
   combined Render API-and-worker topology. Do not deploy both.
3. Deploy the chosen API runtime and assign its final domain.
4. For the separate topology, deploy the worker with the same production
   database and storage values.
5. Configure and deploy the web project with the final API URL.
6. Replace placeholder origins in the API and R2 CORS policy with the final web
   origin, then redeploy the API runtime.
7. Run production smoke testing for authentication, password email, upload,
   extraction, matching, tailoring, ATS analysis, export, sharing, and deletion.

Environment-variable changes apply only to new Vercel deployments. Production
and preview deployments should use separate databases and origins; do not trust
arbitrary `*.vercel.app` origins on the production authentication service.
