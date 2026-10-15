# Repository Instructions

## Project Status Tracking

`docs/PROJECT_STATUS.md` is the authoritative progress log for this repository.

Whenever a major feature is started, completed, materially redesigned, blocked, or deferred, update `docs/PROJECT_STATUS.md` in the same change. A major feature includes a user-facing workflow, a new application or business module, a significant integration, a meaningful infrastructure capability, or a product milestone. Minor styling adjustments, routine refactors, and isolated bug fixes do not require their own milestone unless they change the status of a major feature.

Each major milestone entry should include:

- the date and current status;
- the user-visible or architectural scope delivered;
- the primary files or modules involved when useful;
- the verification performed; and
- any important remaining work or known limitation.

Preserve previous milestones as project history. Update an existing milestone when work extends the same feature, and create a new milestone when the work introduces a distinct major capability. Do not mark a feature complete until its agreed scope has been implemented and verified.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
