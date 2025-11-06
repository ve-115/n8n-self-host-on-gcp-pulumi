# Self-Hosting n8n on Google Cloud Run: Complete Guide

So you want to run n8n without the monthly subscription fees, keep your data under your own control, and avoid the headache of server maintenance? Google Cloud Run offers exactly that sweet spot: fully managed, serverless containers with per-use pricing. This repo gives you a production-ready Pulumi program that stands up the official n8n container on Cloud Run, backed by Cloud SQL Postgres, wrapped with Google Secret Manager, and ready for secure automation at scale.

> **Fast Track**
>
> Prefer infrastructure-as-code that can be executed in a single command? This repository also contains the original Terraform implementation under `terraform/`. The Pulumi version in `src/` is the recommended path if you want strong typing, component reuse, and first-class integration with modern dev tooling.

## Why Teams Self-Host n8n on Cloud Run

- **Predictable cost & scale** – Pay only for requests Cloud Run serves. Autoscaling keeps latency low without paying for idle VM time.
- **Data sovereignty** – Your workflows, credentials, and execution history stay inside your GCP footprint, satisfying security or compliance requirements.
- **Native Google integrations** – Built-in OAuth consent, low-latency access to GCP services, and the ability to use Workload Identity with the deployed service account.
- **Infrastructure as Code** – Pulumi keeps a full inventory of the deployed resources so you can version, review, and promote changes across environments.

## Architecture Overview

```
Pulumi ➜ Cloud Run (n8n container)
				│
				├─ Secret Manager (DB password, encryption key)
				└─ Cloud SQL Postgres (persistent storage)
```

- **Cloud Run Service** (`google_cloud_run_v2_service`) hosts the official `docker.io/n8nio/n8n:latest` image with CPU boost, health probes, and Cloud SQL proxy volume mount.
- **Cloud SQL (Postgres 13)** stores workflow state, credentials, and execution logs.
- **Secret Manager** secures the database password and n8n encryption key generated via `@pulumi/random`.
- **Service Account** carries the minimum IAM roles (Cloud SQL Client, Secret Accessor) and is optionally granted the anonymous `roles/run.invoker` binding for public access.

## Prerequisites

- Google Cloud project with billing enabled.
- Organization policies that permit adding `allUsers` to Cloud Run (only if you enable public access).
- Local tooling: `gcloud`, `pulumi` CLI, Node.js 18+ (for Pulumi Node runtime), and `pnpm` or `npm`.
- Correct Google credentials in your shell (`gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS`).

## Repository Layout

- `src/index.ts` – Pulumi program creating all GCP resources.
- `Pulumi.yaml` – Project definition (Node.js runtime with TypeScript).
- `Pulumi.<stack>.yaml` – Environment-specific configuration files.
- `terraform/` – Original Terraform configuration (optional alternative).

## Pulumi Deployment Steps

1. **Install dependencies**

   ```bash
   pnpm install       # or npm install
   ```

2. **Log in to Pulumi backend** (Pulumi Cloud or local)

   ```bash
   pulumi login
   ```

3. **Select or create a stack**

   ```bash
   pulumi stack init dev   # or pulumi stack select <project>/<stack>
   ```

4. **Configure GCP project and optional overrides**

   ```bash
   pulumi config set gcp:project <your-project-id>
   pulumi config set gcp:region us-west2               # override default region if desired
   pulumi config set n8n-self-host-on-gcp:dbUser n8n   # optional per-stack values
   pulumi config set n8n-self-host-on-gcp:allowUnauthenticated true   # only if org policy allows public access
   ```

   Available Pulumi config keys (namespace `n8n-self-host-on-gcp`):

   | Key                     | Type    | Default               | Purpose                                           |
   | ----------------------- | ------- | --------------------- | ------------------------------------------------- |
   | `dbName`                | string  | `n8n`                 | Cloud SQL database name                           |
   | `dbUser`                | string  | `n8n-user`            | Database username                                 |
   | `dbTier`                | string  | `db-f1-micro`         | Cloud SQL machine tier                            |
   | `dbStorageSize`         | number  | `10`                  | Storage in GB                                     |
   | `cloudRunServiceName`   | string  | `n8n`                 | Cloud Run service name                            |
   | `serviceAccountName`    | string  | `n8n-service-account` | Workload identity                                 |
   | `cloudRunCpu`           | string  | `1`                   | CPU limit per container                           |
   | `cloudRunMemory`        | string  | `2Gi`                 | Memory limit per container                        |
   | `cloudRunMaxInstances`  | number  | `1`                   | Cloud Run autoscaling cap                         |
   | `cloudRunContainerPort` | number  | `5678`                | n8n container port                                |
   | `genericTimezone`       | string  | `UTC`                 | Default timezone for n8n                          |
   | `allowUnauthenticated`  | boolean | `true`                | If true, grants `roles/run.invoker` to `allUsers` |

   Stack-scoped overrides: append `:<stack>` to any key, e.g.
   `pulumi config set n8n-self-host-on-gcp:staging:cloudRunMaxInstances 3`.

5. **Preview and apply**

   ```bash
   pulumi preview   # review changes
   pulumi up        # deploy resources
   ```

   On success Pulumi outputs:

   - Cloud Run URL (`cloudRunServiceUrl`)
   - Cloud SQL connection name (`cloudSqlConnectionName`)
   - Service account email (`n8nServiceAccountEmail`)

6. **Access n8n**
   - If `allowUnauthenticated` is `true`, open the Cloud Run URL directly.
   - Otherwise grant specific identities `roles/run.invoker`:
     ```bash
     gcloud run services add-iam-policy-binding n8n \
      --region <region> \
      --project <project-id> \
      --member user:<you@example.com> \
      --role roles/run.invoker
     ```

## Operations & Maintenance

- **Updates**: Modify configuration or code, run `pulumi up` to apply diffs. Pulumi handles dependency ordering and state management.
- **Teardown**: `pulumi destroy` removes all resources—including the Cloud SQL instance—when you no longer need the stack.
- **Secrets rotation**: Re-run `pulumi up` to regenerate the database password or encryption key. Secret Manager stores new versions automatically, and the Cloud Run revision restarts with fresh credentials.
- **Monitoring**: Use the Cloud Run Logs Viewer (link surfaced in deploy logs) and Cloud SQL monitoring dashboards for runtime health checks.

## Troubleshooting Tips

- **Permission errors when enabling public access**: Ensure no parent organization policy (`iam.allowedPolicyMemberDomains`, `run.managed.requireInvokerIam`) blocks `allUsers`. Allow enough time for policy propagation before reapplying.
- **Container fails to start**: Check Cloud Run logs for startup errors (commonly caused by overriding the container command or misconfigured secrets).
- **Pulumi config missing**: Remember both `gcp:project` and `gcp:region` must be set (or provided via environment variables) before running `pulumi up`.

## Next Steps

- Integrate n8n with Google Workspace by granting the service account scoped OAuth credentials.
- Add Cloud Logging sinks or Cloud Monitoring alerts to detect workflow failures.
- Use Pulumi deployments or CI pipelines to promote changes across dev, staging, and prod stacks.

Enjoy automation freedom with n8n on Google Cloud Run—fully controlled, cost-efficient, and managed as code.
