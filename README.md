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

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
```

Architecture and product decisions are maintained in `docs/`.
