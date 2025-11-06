import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { CloudRunConfig, DatabaseConfig } from "../types/config.types";
import { CloudRunServiceResources, SecretsResources } from "../types/components.types";

interface CreateCloudRunServiceArgs {
  project: string;
  region: string;
  timezone: string;
  cloudRunConfig: CloudRunConfig;
  dbConfig: DatabaseConfig;
  dbInstance: gcp.sql.DatabaseInstance;
  serviceAccountEmail: pulumi.Input<string>;
  secrets: SecretsResources;
  allowUnauthenticated: boolean;
  dependencies?: pulumi.Resource[];
}

export const createCloudRunService = ({
  project,
  region,
  timezone,
  cloudRunConfig,
  dbConfig,
  dbInstance,
  serviceAccountEmail,
  secrets,
  allowUnauthenticated,
  dependencies,
}: CreateCloudRunServiceArgs): CloudRunServiceResources => {
  const projectDetails = pulumi.output(gcp.organizations.getProject({ projectId: project }));
  const projectNumber = projectDetails.number;
  const serviceHost = pulumi.interpolate`${cloudRunConfig.serviceName}-${projectNumber}.${region}.run.app`;
  const serviceUrl = pulumi.interpolate`https://${serviceHost}`;

  const dependsOn: pulumi.Resource[] = [dbInstance, secrets.dbPasswordSecretVersion, secrets.encryptionKeySecretVersion, ...(dependencies ?? [])];

  const service = new gcp.cloudrunv2.Service(
    "n8nService",
    {
      name: cloudRunConfig.serviceName,
      project,
      location: region,
      ingress: "INGRESS_TRAFFIC_ALL",
      deletionProtection: false,
      template: {
        serviceAccount: serviceAccountEmail,
        scaling: {
          maxInstanceCount: cloudRunConfig.maxInstances,
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
              containerPort: cloudRunConfig.containerPort,
            },
            resources: {
              limits: {
                cpu: cloudRunConfig.cpu,
                memory: cloudRunConfig.memory,
              },
              startupCpuBoost: true,
              cpuIdle: false,
            },
            envs: [
              {
                name: "N8N_PORT",
                value: cloudRunConfig.containerPort.toString(),
              },
              { name: "N8N_PROTOCOL", value: "https" },
              { name: "DB_TYPE", value: "postgresdb" },
              { name: "DB_POSTGRESDB_DATABASE", value: dbConfig.name },
              { name: "DB_POSTGRESDB_USER", value: dbConfig.user },
              {
                name: "DB_POSTGRESDB_HOST",
                value: pulumi.interpolate`/cloudsql/${dbInstance.connectionName}`,
              },
              { name: "DB_POSTGRESDB_PORT", value: "5432" },
              { name: "DB_POSTGRESDB_SCHEMA", value: "public" },
              { name: "N8N_USER_FOLDER", value: "/home/node/.n8n" },
              { name: "GENERIC_TIMEZONE", value: timezone },
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
                    secret: secrets.dbPasswordSecret.secretId,
                    version: "latest",
                  },
                },
              },
              {
                name: "N8N_ENCRYPTION_KEY",
                valueSource: {
                  secretKeyRef: {
                    secret: secrets.encryptionKeySecret.secretId,
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
                port: cloudRunConfig.containerPort,
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
    { dependsOn }
  );

  let publicInvoker: gcp.cloudrunv2.ServiceIamMember | undefined;
  if (allowUnauthenticated) {
    publicInvoker = new gcp.cloudrunv2.ServiceIamMember(
      "n8nPublicInvoker",
      {
        project,
        location: service.location,
        name: service.name,
        role: "roles/run.invoker",
        member: "allUsers",
      },
      { dependsOn: [service] }
    );
  }

  return {
    service,
    publicInvoker,
    serviceHost,
    serviceUrl,
  };
};
