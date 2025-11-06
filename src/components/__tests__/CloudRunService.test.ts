import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { createCloudRunService } from "../cloudRunService";
import { CloudRunConfig, DatabaseConfig } from "../../types/config.types";
import { SecretsResources } from "../../types/components.types";

interface RecordedResource extends pulumi.runtime.MockResourceArgs {}

const recordedResources: RecordedResource[] = [];

class DummyResource extends pulumi.CustomResource {
  constructor(name: string) {
    super("test:resource:Dummy", name, {});
  }
}

const resolveOutput = async <T>(output: pulumi.Output<T>): Promise<T> =>
  new Promise<T>((resolve) => {
    output.apply((value) => {
      resolve(value);
      return value;
    });
  });

const buildSecrets = (suffix: string): SecretsResources =>
  ({
    dbPasswordSecret: {
      secretId: `projects/test/secrets/db-password-${suffix}`,
    },
    dbPasswordSecretVersion: new DummyResource(
      `dbPasswordSecretVersion-${suffix}`
    ),
    encryptionKeySecret: {
      secretId: `projects/test/secrets/encryption-${suffix}`,
    },
    encryptionKeySecretVersion: new DummyResource(
      `encryptionKeySecretVersion-${suffix}`
    ),
    dbPasswordSecretAccessor: new DummyResource(
      `dbPasswordSecretAccessor-${suffix}`
    ),
    encryptionKeySecretAccessor: new DummyResource(
      `encryptionKeySecretAccessor-${suffix}`
    ),
  } as unknown as SecretsResources);

beforeAll(() => {
  pulumi.runtime.setMocks(
    {
      newResource: (args) => {
        recordedResources.push(args);
        const state: Record<string, unknown> = { ...args.inputs };
        if (args.type === "gcp:sql/databaseInstance:DatabaseInstance") {
          state.connectionName = pulumi.output(`${args.name}-connection`);
        }
        return { id: `${args.name}-id`, state };
      },
      call: (args) => {
        if (args.token === "gcp:organizations/getProject:getProject") {
          return { number: "1234567890" };
        }
        return {};
      },
    },
    "test-project",
    "dev"
  );
});

beforeEach(() => {
  recordedResources.length = 0;
});

describe("createCloudRunService", () => {
  const baseCloudRunConfig: CloudRunConfig = {
    serviceName: "n8n-service",
    serviceAccountName: "n8n-sa",
    containerPort: 5678,
    cpu: "1",
    memory: "512Mi",
    maxInstances: 3,
  } as CloudRunConfig;

  const baseDbConfig: DatabaseConfig = {
    name: "n8n",
    user: "n8nuser",
  } as DatabaseConfig;

  it("creates Cloud Run service and public IAM binding when unauthenticated access is allowed", async () => {
    const resolved = (await pulumi.runtime.runInPulumiStack(async () => {
      const dbInstance = new gcp.sql.DatabaseInstance("db-instance-allow", {
        name: "db-instance-allow",
        region: "us-central1",
        databaseVersion: "POSTGRES_15",
        settings: {
          tier: "db-f1-micro",
        },
      });

      const result = createCloudRunService({
        project: "test-project",
        region: "us-central1",
        timezone: "UTC",
        cloudRunConfig: {
          ...baseCloudRunConfig,
          serviceName: "service-allow",
        },
        dbConfig: baseDbConfig,
        dbInstance,
        serviceAccountEmail: pulumi.output(
          "service-account@test-project.iam.gserviceaccount.com"
        ),
        secrets: buildSecrets("allow"),
        allowUnauthenticated: true,
      });

      if (!result.publicInvoker) {
        throw new Error("publicInvoker not created");
      }

      const host = await resolveOutput(result.serviceHost);
      const url = await resolveOutput(result.serviceUrl);
      const serviceName = await resolveOutput(result.service.name);
      const publicInvokerUrn = await resolveOutput(result.publicInvoker.urn);

      return { host, url, serviceName, publicInvokerUrn };
    })) as {
      host: string;
      url: string;
      serviceName: string;
      publicInvokerUrn: string;
    };

    expect(resolved.host).toBe("service-allow-1234567890.us-central1.run.app");
    expect(resolved.url).toBe(
      "https://service-allow-1234567890.us-central1.run.app"
    );
    expect(resolved.serviceName).toBe("service-allow");
    expect(resolved.publicInvokerUrn).toContain("cloudrunv2/serviceIamMember");

    const serviceResource = recordedResources.find(
      (res) => res.type === "gcp:cloudrunv2/service:Service"
    );
    expect(serviceResource).toBeDefined();

    const envs = serviceResource!.inputs.template.containers[0].envs;
    const portEnv = envs.find((env: any) => env.name === "N8N_PORT");
    expect(portEnv.value).toBe("5678");

    const encryptionEnv = envs.find(
      (env: any) => env.name === "N8N_ENCRYPTION_KEY"
    );
    expect(encryptionEnv.valueSource.secretKeyRef.secret).toBe(
      "projects/test/secrets/encryption-allow"
    );
  });

  it("skips public IAM binding when unauthenticated access is disabled", async () => {
    const hasPublicInvoker = await pulumi.runtime.runInPulumiStack(async () => {
      const dbInstance = new gcp.sql.DatabaseInstance("db-instance-deny", {
        name: "db-instance-deny",
        region: "us-central1",
        databaseVersion: "POSTGRES_15",
        settings: {
          tier: "db-f1-micro",
        },
      });

      const result = createCloudRunService({
        project: "test-project",
        region: "us-central1",
        timezone: "UTC",
        cloudRunConfig: {
          ...baseCloudRunConfig,
          serviceName: "service-deny",
        },
        dbConfig: baseDbConfig,
        dbInstance,
        serviceAccountEmail: pulumi.output(
          "service-account@test-project.iam.gserviceaccount.com"
        ),
        secrets: buildSecrets("deny"),
        allowUnauthenticated: false,
      });

      await resolveOutput(result.service.name);

      return Boolean(result.publicInvoker);
    });

    expect(hasPublicInvoker).toBe(false);
  });
});
