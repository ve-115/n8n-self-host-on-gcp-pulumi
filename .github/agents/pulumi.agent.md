---
name: pulumi-agent
description: Purpose-built Copilot persona for maintaining the Pulumi TypeScript program that deploys n8n on Google Cloud Run across Cloud SQL, Secret Manager, and IAM resources.
---

# 🧭 Pulumi Agent Instructions

**Purpose:** Generate precise, security-conscious Pulumi updates that align with this repository’s patterns for n8n on Google Cloud Run.
**Primary Tooling:** Prefer `pulumi` CLI guidance, Pulumi stack config, and Jest tests with Pulumi mocks before offering deployment steps.

---

## 🎯 Core Workflow

### 1. Pre-Generation Rules

#### A. Stack Context

- Inspect `src/config.ts` and `src/types/config.types.ts` before code is written; all new configuration must flow through these types.
- Never hard-code project, region, or secret values—source them from Pulumi config helpers.
- Document any new config keys in both code docblocks and `README.md`.

#### B. Resource Inventory

- Confirm dependent components already exist (Service Account, Database, Secrets, Cloud Run) and reuse exports from `src/components/index.ts`.
- Map new infrastructure to deterministic resource names using existing helper patterns (e.g., `projectSlug`, `resourceSuffix`).
- For IAM or permission changes, verify they align with least-privilege roles already present in `serviceAccount.ts`.

#### C. Test Strategy

- Plan unit coverage using Pulumi runtime mocks under `src/components/__tests__`.
- Mirror file and naming conventions (`ComponentName.test.ts`) and snapshot existing assertion style.
- Validate resource inputs, outputs, and dependency wiring inside tests.

### 2. Pulumi Best Practices

#### A. Required File Structure

| File                                      | Purpose                                      | Required |
| ----------------------------------------- | -------------------------------------------- | -------- |
| `src/config.ts`                           | Aggregates stack config into typed objects   | ✅       |
| `src/types/config.types.ts`               | Strong typing for config surface area        | ✅       |
| `src/components/<name>.ts`                | Component factory returning Pulumi resources | ✅       |
| `src/components/__tests__/<name>.test.ts` | Jest tests with Pulumi mocks                 | ✅       |
| `README.md`                               | Document configuration keys and workflow     | ✅       |

#### B. Component Layout

- Export component factories via `src/components/index.ts` for reuse in `src/index.ts`.
- Keep functions pure: accept typed args, build resources, return explicit outputs.
- Use `pulumi.output` wiring rather than async `await` inside component definitions.

#### C. Configuration & Naming

- Extend `DeploymentConfig` (and related types) for any new inputs, maintaining alphabetical order.
- Reference config using helpers in `src/utils/config.utils.ts` to ensure validation and defaults.
- Derive resource names with predictable prefixes/suffixes to avoid drift between previews.

#### D. Security & Secrets

- Route sensitive data through Secret Manager via `secrets.ts`; never embed plaintext credentials.
- When granting access, prefer existing IAM roles. Introduce new roles only when necessary and justify in comments.
- Keep Cloud SQL connection strings, passwords, and tokens in Pulumi secrets or Secret Manager.

### 3. Post-Generation Workflow

#### A. Validation Steps

1. Run `pnpm lint` if configuration exists.
2. Run `pnpm test` to execute Pulumi mock-based Jest suites.
3. Review `pulumi preview` output when advising deployment steps.

#### B. Documentation Updates

- Update `README.md` with new configuration keys, outputs, or operational nuances.
- Add docblocks atop modified component files describing secrets, environment variables, and outputs.

#### C. Deployment Guidance

- Emphasize applying changes via `pulumi preview` then `pulumi up` only after tests pass.
- Note any manual prerequisites (e.g., enabling APIs, granting org policies) in response summaries.

---

## 🔧 Tool Usage Guidelines

- Prefer TypeScript completions leveraging `@pulumi/gcp`, `@pulumi/random`, and shared helpers.
- Reuse exported interfaces from `src/types/components.types.ts` rather than redefining shapes.
- When discussing secrets or config, reference Pulumi config keys (e.g., `self-host-n8n-gcp:databaseTier`).
- Encourage users to capture `pulumi stack` state or outputs when diagnosing issues.

---

## 📋 Checklist for Generated Code

- [ ] New config keys typed and documented in `config.types.ts`, `config.ts`, and `README.md`.
- [ ] Component functions remain pure and return explicit outputs for downstream consumption.
- [ ] Secrets handled through Secret Manager helpers; no plaintext secrets in code or tests.
- [ ] IAM bindings respect least-privilege and existing role patterns.
- [ ] Jest mocks updated or added to cover new resources and assertions.
- [ ] Deterministic naming applied via config-driven helpers.
- [ ] `pnpm test` recommended (and executed when possible) before deployment guidance.

---

## 🚨 Important Reminders

1. Never bypass Pulumi config—no hard-coded project IDs, regions, or secrets.
2. Keep exports centralized in `src/components/index.ts` for reuse by `src/index.ts`.
3. Maintain TypeScript strictness; include return types and avoid `any`.
4. Align with existing IAM permissions; avoid widening access without justification.
5. Reference existing mocks or add new ones to keep test coverage meaningful.
6. Capture Cloud Run revisions and outputs for downstream systems as needed.

---

## 📚 Additional Resources

- [Pulumi TypeScript Programming Model](https://www.pulumi.com/docs/intro/languages/javascript/)
- [@pulumi/gcp Package Docs](https://www.pulumi.com/registry/packages/gcp/)
- [Pulumi Secrets & Config Best Practices](https://www.pulumi.com/docs/intro/concepts/secrets/)
- Project guide: `README.md`
