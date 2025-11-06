import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { DeploymentConfig } from "./types/config.types";
import { requireConfigBoolean, requireConfigNumber, requireConfigString } from "./utils/config.utils";

const project = gcp.config.project;
if (!project) {
  throw new Error("Set gcp:project via Pulumi config before deploying.");
}

const region = gcp.config.region;
if (!region) {
  throw new Error("Set gcp:region via Pulumi config before deploying.");
}

const stackConfig = new pulumi.Config("n8n-self-host-on-gcp");

const deploymentConfig: DeploymentConfig = {
  gcp: {
    project,
    region,
  },
  db: {
    name: requireConfigString(stackConfig, "dbName"),
    user: requireConfigString(stackConfig, "dbUser"),
    tier: requireConfigString(stackConfig, "dbTier"),
    version: requireConfigString(stackConfig, "dbVersion"),
    storageSize: requireConfigNumber(stackConfig, "dbStorageSize"),
  },
  cloudRun: {
    serviceName: requireConfigString(stackConfig, "cloudRunServiceName"),
    serviceAccountName: requireConfigString(stackConfig, "serviceAccountName"),
    cpu: requireConfigString(stackConfig, "cloudRunCpu"),
    memory: requireConfigString(stackConfig, "cloudRunMemory"),
    maxInstances: requireConfigNumber(stackConfig, "cloudRunMaxInstances"),
    containerPort: requireConfigNumber(stackConfig, "cloudRunContainerPort"),
  },
  timezone: requireConfigString(stackConfig, "genericTimezone"),
  allowUnauthenticated: requireConfigBoolean(stackConfig, "allowUnauthenticated"),
};

export default deploymentConfig;
