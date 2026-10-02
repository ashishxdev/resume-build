# Make My Resume

Make My Resume is a resume-tailoring SaaS built as a TypeScript modular monolith.

## Workspaces

- `apps/web`: Next.js frontend
- `apps/api`: Express API and background worker processes
- `packages/contracts`: provider- and persistence-independent shared contracts
- `packages/resume-engine`: pure resume domain logic
- `packages/resume-renderer`: shared resume rendering primitives
- `packages/eslint-config`: shared lint rules
- `packages/typescript-config`: shared strict TypeScript configuration

## Requirements

- Node.js 22 or newer
- pnpm 12.8.1 (managed through Corepack)

## Development

Copy `.env.example` to the repository-root `.env.local` when local service
configuration is needed. The web app, API, and worker all load the root
`.env.local` first and then `.env` as a fallback. Deployment-provided
environment variables take precedence. Never commit real secrets.

```bash
pnpm dev
pnpm web
pnpm api
pnpm worker
```

The web app defaults to `http://localhost:3000`. The API defaults to `http://localhost:4000`, with health information at `GET /health`.

### Cloudflare R2 resume uploads

Resume originals upload directly from the browser to R2 with a short-lived,
content-type-bound signed URL. Configure the `R2_*` values in `.env.local`,
then add this CORS policy to the R2 bucket for local development:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add the deployed web origin to `AllowedOrigins` before production. Signed URLs
are bearer credentials, so they must not be logged or shared.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
```

Architecture and product decisions are maintained in `docs/`.
