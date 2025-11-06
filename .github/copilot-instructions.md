# GitHub Copilot Instructions

## Project Context

- TypeScript Pulumi program deploying n8n on Google Cloud Run with Cloud SQL and Secret Manager.
- Components live under `src/components`, shared types in `src/types`, configuration logic in `src/config.ts`, and tests in `src/components/__tests__`.
- Jest tests rely on Pulumi runtime mocks; `pnpm test` is the guardrail before `pulumi preview` or `pulumi up`.

## Usage Guidelines

- Prefer TypeScript completions; align with existing naming (`ProjectServices`, `CloudRunService`, etc.) and export patterns.
- Keep infrastructure definitions deterministic: reference Pulumi config via utilities in `src/config.ts`, avoid hard-coded literals.
- When suggesting IAM or secrets, reuse helpers from component modules and follow least-privilege practices already present.

## Prompt Patterns

- _"Generate a Pulumi component in `src/components/cloudRunService.ts` that mounts Cloud SQL and injects Secret Manager values."_
- _"Add a Jest mock for `@pulumi/gcp` matching the pattern in `src/components/__tests__/database.test.ts`."_
- _"Expand `config.types.ts` with a new optional property for Redis cache settings and update consuming modules."_

## Code Quality

- Enforce TypeScript strictness, use `async/await` with explicit return types, and keep functions small.
- Mirror test layout with `*.test.ts` files beside components; ensure new resources have assertion coverage.
- Run `pnpm lint` (if configured) and `pnpm test` before committing generated code.

## Documentation & Comments

- Document environment variables, secrets, and Pulumi outputs within module docblocks.
- Update `README.md` when changing deployment behavior or configuration keys.

## Security & Compliance

- Never expose real secrets; continue using Pulumi config and Secret Manager references.
- Ensure Copilot completions respect existing IAM bindings and do not widen access unintentionally.

## Productivity Tips

- Ask for multiple Copilot completions to compare resource wiring options.
- Use inline prompts to scaffold repetitive Pulumi inputs (labels, annotations, container args).
- When in doubt, reference official `@pulumi/gcp` typings or the Pulumi docs for argument structures.
