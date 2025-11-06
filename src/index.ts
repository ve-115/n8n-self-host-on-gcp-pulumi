import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as random from "@pulumi/random";

const project =
  gcp.config.project ?? process.env.GCP_PROJECT ?? process.env.GOOGLE_PROJECT;
if (!project) {
  throw new Error(
    "Configure gcp:project (or set GCP_PROJECT / GOOGLE_PROJECT) before running Pulumi."
  );
}

const region = gcp.config.region ?? process.env.GCP_REGION ?? "us-west2";

const config = new pulumi.Config("n8n-self-host-on-gcp");
const dbName = config.get("dbName") ?? "n8n";
const dbUser = config.get("dbUser") ?? "n8n-user";
const dbTier = config.get("dbTier") ?? "db-f1-micro";
const dbStorageSize = config.getNumber("dbStorageSize") ?? 10;
const cloudRunServiceName = config.get("cloudRunServiceName") ?? "n8n";
const serviceAccountName =
  config.get("serviceAccountName") ?? "n8n-service-account";
const cloudRunCpu = config.get("cloudRunCpu") ?? "1";
const cloudRunMemory = config.get("cloudRunMemory") ?? "2Gi";
const cloudRunMaxInstances = config.getNumber("cloudRunMaxInstances") ?? 1;
const cloudRunContainerPort = config.getNumber("cloudRunContainerPort") ?? 5678;
const genericTimezone = config.get("genericTimezone") ?? "UTC";

// Enable core services required for the deployment.
const runApi = new gcp.projects.Service("runApi", {
  service: "run.googleapis.com",
  disableOnDestroy: false,
});

const sqlAdminApi = new gcp.projects.Service("sqlAdminApi", {
  service: "sqladmin.googleapis.com",
  disableOnDestroy: false,
});

const secretManagerApi = new gcp.projects.Service("secretManagerApi", {
  service: "secretmanager.googleapis.com",
  disableOnDestroy: false,
});

const resourceManagerApi = new gcp.projects.Service("resourceManagerApi", {
  service: "cloudresourcemanager.googleapis.com",
  disableOnDestroy: false,
});

const dbInstanceName = `${cloudRunServiceName}-db`;

const dbPassword = new random.RandomPassword("dbPassword", {
  length: 16,
  special: true,
  minUpper: 1,
  minLower: 1,
  minNumeric: 1,
  minSpecial: 1,
  keepers: {
    dbInstance: dbInstanceName,
    dbUser,
  },
});

const n8nEncryptionKey = new random.RandomPassword("n8nEncryptionKey", {
  length: 32,
  special: false,
});

const dbInstance = new gcp.sql.DatabaseInstance(
  "n8nDbInstance",
  {
    name: dbInstanceName,
    project,
    region,
    databaseVersion: "POSTGRES_13",
    settings: {
      tier: dbTier,
      availabilityType: "ZONAL",
      diskType: "PD_HDD",
      diskSize: dbStorageSize,
      backupConfiguration: {
        enabled: false,
      },
    },
    deletionProtection: false,
  },
  { dependsOn: [sqlAdminApi] }
);

const database = new gcp.sql.Database("n8nDatabase", {
  name: dbName,
  instance: dbInstance.name,
  project,
});

const databaseUser = new gcp.sql.User("n8nUser", {
  name: dbUser,
  instance: dbInstance.name,
  password: dbPassword.result,
  project,
});

const dbPasswordSecret = new gcp.secretmanager.Secret(
  "dbPasswordSecret",
  {
    secretId: `${cloudRunServiceName}-db-password`,
    project,
    replication: {
      auto: {},
    },
  },
  { dependsOn: [secretManagerApi] }
);

const dbPasswordSecretVersion = new gcp.secretmanager.SecretVersion(
  "dbPasswordSecretVersion",
  {
    secret: dbPasswordSecret.id,
    secretData: dbPassword.result,
  }
);

const encryptionKeySecret = new gcp.secretmanager.Secret(
  "encryptionKeySecret",
  {
    secretId: `${cloudRunServiceName}-encryption-key`,
    project,
    replication: {
      auto: {},
    },
  },
  { dependsOn: [secretManagerApi] }
);

const encryptionKeySecretVersion = new gcp.secretmanager.SecretVersion(
  "encryptionKeySecretVersion",
  {
    secret: encryptionKeySecret.id,
    secretData: n8nEncryptionKey.result,
  }
);

const serviceAccount = new gcp.serviceaccount.Account("n8nServiceAccount", {
  accountId: serviceAccountName,
  displayName: "n8n Service Account for Cloud Run",
  project,
});

const dbPasswordSecretAccessor = new gcp.secretmanager.SecretIamMember(
  "dbPasswordSecretAccessor",
  {
    project: dbPasswordSecret.project,
    secretId: dbPasswordSecret.secretId,
    role: "roles/secretmanager.secretAccessor",
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
  }
);

const encryptionKeySecretAccessor = new gcp.secretmanager.SecretIamMember(
  "encryptionKeySecretAccessor",
  {
    project: encryptionKeySecret.project,
    secretId: encryptionKeySecret.secretId,
    role: "roles/secretmanager.secretAccessor",
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
  }
);

const sqlClientRole = new gcp.projects.IAMMember("sqlClientRole", {
  project,
  role: "roles/cloudsql.client",
  member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
});

const projectDetails = pulumi.output(
  gcp.organizations.getProject({ projectId: project })
);
const projectNumber = projectDetails.number;
const serviceHost = pulumi.interpolate`${cloudRunServiceName}-${projectNumber}.${region}.run.app`;
const serviceUrl = pulumi.interpolate`https://${serviceHost}`;

const n8nService = new gcp.cloudrunv2.Service(
  "n8nService",
  {
    name: cloudRunServiceName,
    project,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    deletionProtection: false,
    template: {
      serviceAccount: serviceAccount.email,
      scaling: {
        maxInstanceCount: cloudRunMaxInstances,
        minInstanceCount: 0,
      },
      volumes: [
        {
          name: "cloudsql",
          cloudSqlInstance: {
            instances: [dbInstance.connectionName],
          },
        },
      ],
      containers: [
        {
          image: "docker.io/n8nio/n8n:latest",
          volumeMounts: [
            {
              name: "cloudsql",
              mountPath: "/cloudsql",
            },
          ],
          ports: {
            containerPort: cloudRunContainerPort,
          },
          resources: {
            limits: {
              cpu: cloudRunCpu,
              memory: cloudRunMemory,
            },
            startupCpuBoost: true,
            cpuIdle: false,
          },
          envs: [
            { name: "N8N_PORT", value: cloudRunContainerPort.toString() },
            { name: "N8N_PROTOCOL", value: "https" },
            { name: "DB_TYPE", value: "postgresdb" },
            { name: "DB_POSTGRESDB_DATABASE", value: dbName },
            { name: "DB_POSTGRESDB_USER", value: dbUser },
            {
              name: "DB_POSTGRESDB_HOST",
              value: pulumi.interpolate`/cloudsql/${dbInstance.connectionName}`,
            },
            { name: "DB_POSTGRESDB_PORT", value: "5432" },
            { name: "DB_POSTGRESDB_SCHEMA", value: "public" },
            { name: "N8N_USER_FOLDER", value: "/home/node/.n8n" },
            { name: "GENERIC_TIMEZONE", value: genericTimezone },
            { name: "QUEUE_HEALTH_CHECK_ACTIVE", value: "true" },
            { name: "N8N_RUNNERS_ENABLED", value: "true" },
            { name: "N8N_PROXY_HOPS", value: "1" },
            { name: "N8N_HOST", value: serviceHost },
            { name: "WEBHOOK_URL", value: serviceUrl },
            { name: "N8N_EDITOR_BASE_URL", value: serviceUrl },
            {
              name: "DB_POSTGRESDB_PASSWORD",
              valueSource: {
                secretKeyRef: {
                  secret: dbPasswordSecret.secretId,
                  version: "latest",
                },
              },
            },
            {
              name: "N8N_ENCRYPTION_KEY",
              valueSource: {
                secretKeyRef: {
                  secret: encryptionKeySecret.secretId,
                  version: "latest",
                },
              },
            },
          ],
          startupProbe: {
            initialDelaySeconds: 30,
            timeoutSeconds: 240,
            periodSeconds: 240,
            failureThreshold: 3,
            tcpSocket: {
              port: cloudRunContainerPort,
            },
          },
        },
      ],
    },
    traffics: [
      {
        type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST",
        percent: 100,
      },
    ],
  },
  {
    dependsOn: [
      runApi,
      resourceManagerApi,
      sqlClientRole,
      dbPasswordSecretAccessor,
      encryptionKeySecretAccessor,
      dbPasswordSecretVersion,
      encryptionKeySecretVersion,
    ],
  }
);

const publicInvoker = new gcp.cloudrunv2.ServiceIamMember(
  "n8nPublicInvoker",
  {
    project,
    location: n8nService.location,
    name: n8nService.name,
    role: "roles/run.invoker",
    member: "allUsers",
  },
  { dependsOn: [n8nService] }
);

export const cloudRunServiceUrl = n8nService.uri;
export const cloudSqlConnectionName = dbInstance.connectionName;
export const n8nServiceAccountEmail = serviceAccount.email;
