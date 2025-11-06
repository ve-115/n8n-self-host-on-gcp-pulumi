import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface DeploymentConfig {
  gcp: {
    project: string;
    region: string;
  };
  db: {
    name: string;
    user: string;
    tier: string;
    storageSize: number;
  };
  cloudRun: {
    serviceName: string;
    serviceAccountName: string;
    cpu: string;
    memory: string;
    maxInstances: number;
    containerPort: number;
  };
  timezone: string;
  allowUnauthenticated: boolean;
}

const gcpProject = gcp.config.project;
if (!gcpProject) {
  throw new Error("Set gcp:project via Pulumi config before deploying.");
}

const gcpRegion = gcp.config.region;
if (!gcpRegion) {
  throw new Error("Set gcp:region via Pulumi config before deploying.");
}

const stackConfig = new pulumi.Config("n8n-self-host-on-gcp");

const requireString = (key: string) => {
  const value = stackConfig.get(key)?.trim();
  if (!value) {
    throw new Error(`Set n8n-self-host-on-gcp:${key} via Pulumi config.`);
  }
  return value;
};

const requireNumber = (key: string) => {
  const value = stackConfig.getNumber(key);
  if (value === undefined) {
    throw new Error(`Set numeric config n8n-self-host-on-gcp:${key}.`);
  }
  return value;
};

const requireBoolean = (key: string) => {
  const value = stackConfig.getBoolean(key);
  if (value === undefined) {
    throw new Error(`Set boolean config n8n-self-host-on-gcp:${key}.`);
  }
  return value;
};

const deploymentConfig: DeploymentConfig = {
  gcp: {
    project: gcpProject,
    region: gcpRegion,
  },
  db: {
    name: requireString("dbName"),
    user: requireString("dbUser"),
    tier: requireString("dbTier"),
    storageSize: requireNumber("dbStorageSize"),
  },
  cloudRun: {
    serviceName: requireString("cloudRunServiceName"),
    serviceAccountName: requireString("serviceAccountName"),
    cpu: requireString("cloudRunCpu"),
    memory: requireString("cloudRunMemory"),
    maxInstances: requireNumber("cloudRunMaxInstances"),
    containerPort: requireNumber("cloudRunContainerPort"),
  },
  timezone: requireString("genericTimezone"),
  allowUnauthenticated: requireBoolean("allowUnauthenticated"),
};

export default deploymentConfig;
