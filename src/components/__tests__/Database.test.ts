import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { createDatabase } from "../database";
import { DatabaseConfig } from "../../types/config.types";

interface RecordedResource extends pulumi.runtime.MockResourceArgs {}

const recordedResources: RecordedResource[] = [];

const resolveOutput = async <T>(output: pulumi.Output<T>): Promise<T> =>
  new Promise<T>((resolve) => {
    output.apply((value) => {
      resolve(value);
      return value;
    });
  });

beforeAll(() => {
  pulumi.runtime.setMocks(
    {
      newResource: (args) => {
        recordedResources.push(args);
        if (args.type === "random:index/randomPassword:RandomPassword") {
          return {
            id: `${args.name}-id`,
            state: {
              ...args.inputs,
              result: "mock-password",
            },
          };
        }

        return {
          id: `${args.name}-id`,
          state: {
            ...args.inputs,
          },
        };
      },
      call: () => ({}),
    },
    "test-project",
    "dev"
  );
});

beforeEach(() => {
  recordedResources.length = 0;
});

describe("createDatabase", () => {
  const baseConfig: DatabaseConfig = {
    name: "n8n",
    user: "n8nuser",
    tier: "db-f1-micro",
    version: "POSTGRES_15",
    storageSize: 20,
  };

  it("creates Cloud SQL resources with expected configuration", async () => {
    const results = (await pulumi.runtime.runInPulumiStack(async () => {
      const sqlAdminApi = new gcp.projects.Service("sqlAdminApi", {
        service: "sqladmin.googleapis.com",
        disableOnDestroy: false,
      });

      const resources = createDatabase({
        project: "test-project",
        region: "us-central1",
        serviceName: "n8n-service",
        dbConfig: baseConfig,
        sqlAdminApi,
      });

      const instanceName = await resolveOutput(resources.instance.name);
      const databaseName = await resolveOutput(resources.database.name);
      const userName = await resolveOutput(resources.user.name);
      const passwordResult = await resolveOutput(resources.password.result);

      return {
        instanceName,
        databaseName,
        userName,
        passwordResult,
      };
    })) as {
      instanceName: string;
      databaseName: string;
      userName: string;
      passwordResult: string;
    };

    expect(results.instanceName).toBe("n8n-service-db");
    expect(results.databaseName).toBe(baseConfig.name);
    expect(results.userName).toBe(baseConfig.user);
    expect(results.passwordResult).toBe("mock-password");

    const passwordResource = recordedResources.find((res) => res.type === "random:index/randomPassword:RandomPassword");
    expect(passwordResource).toBeDefined();
    expect(passwordResource!.inputs.length).toBe(16);
    expect(passwordResource!.inputs.special).toBe(true);
    expect(passwordResource!.inputs.keepers.dbInstance).toBe("n8n-service-db");
    expect(passwordResource!.inputs.keepers.dbUser).toBe(baseConfig.user);

    const instanceResource = recordedResources.find((res) => res.type === "gcp:sql/databaseInstance:DatabaseInstance");
    expect(instanceResource).toBeDefined();
    expect(instanceResource!.inputs.name).toBe("n8n-service-db");
    expect(instanceResource!.inputs.project).toBe("test-project");
    expect(instanceResource!.inputs.region).toBe("us-central1");
    expect(instanceResource!.inputs.databaseVersion).toBe(baseConfig.version);
    expect(instanceResource!.inputs.deletionProtection).toBe(false);
    expect(instanceResource!.inputs.settings.tier).toBe(baseConfig.tier);
    expect(instanceResource!.inputs.settings.availabilityType).toBe("ZONAL");
    expect(instanceResource!.inputs.settings.diskType).toBe("PD_HDD");
    expect(instanceResource!.inputs.settings.diskSize).toBe(baseConfig.storageSize);
    expect(instanceResource!.inputs.settings.backupConfiguration.enabled).toBe(false);

    const databaseResource = recordedResources.find((res) => res.type === "gcp:sql/database:Database");
    expect(databaseResource).toBeDefined();
    expect(databaseResource!.inputs.name).toBe(baseConfig.name);
    expect(databaseResource!.inputs.instance).toBe("n8n-service-db");
    expect(databaseResource!.inputs.project).toBe("test-project");

    const userResource = recordedResources.find((res) => res.type === "gcp:sql/user:User");
    expect(userResource).toBeDefined();
    expect(userResource!.inputs.name).toBe(baseConfig.user);
    expect(userResource!.inputs.instance).toBe("n8n-service-db");
    expect(userResource!.inputs.project).toBe("test-project");
    expect(userResource!.inputs.password.value).toBe("mock-password");

    const sqlAdminApiResource = recordedResources.find((res) => res.type === "gcp:projects/service:Service");
    expect(sqlAdminApiResource).toBeDefined();
    expect(sqlAdminApiResource!.inputs.service).toBe("sqladmin.googleapis.com");
  });
});
