import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { createSecrets } from "../secrets";

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
              result: "mock-encryption-key",
            },
          };
        }

        if (args.type === "gcp:serviceaccount/account:Account") {
          const accountId = typeof args.inputs.accountId === "string" ? args.inputs.accountId : args.name;

          return {
            id: `${args.name}-id`,
            state: {
              ...args.inputs,
              email: `${accountId}@test-project.iam.gserviceaccount.com`,
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

const runSecretsStack = async () => {
  return (await pulumi.runtime.runInPulumiStack(async () => {
    const secretManagerApi = new gcp.projects.Service("secretManagerApi", {
      service: "secretmanager.googleapis.com",
      disableOnDestroy: false,
    });

    const serviceAccount = new gcp.serviceaccount.Account("serviceAccount", {
      accountId: "n8n-service-account",
      project: "test-project",
      displayName: "n8n service account",
    });

    const secrets = createSecrets({
      project: "test-project",
      serviceName: "n8n-service",
      dbPassword: pulumi.output("mock-db-password"),
      serviceAccount,
      secretManagerApi,
    });

    return {
      dbSecretId: await resolveOutput(secrets.dbPasswordSecret.secretId),
      dbSecretProject: await resolveOutput(secrets.dbPasswordSecret.project),
      dbVersionSecret: await resolveOutput(secrets.dbPasswordSecretVersion.secret),
      dbVersionData: await resolveOutput(secrets.dbPasswordSecretVersion.secretData),
      encryptionSecretId: await resolveOutput(secrets.encryptionKeySecret.secretId),
      encryptionSecretProject: await resolveOutput(secrets.encryptionKeySecret.project),
      encryptionVersionSecret: await resolveOutput(secrets.encryptionKeySecretVersion.secret),
      encryptionVersionData: await resolveOutput(secrets.encryptionKeySecretVersion.secretData),
      encryptionKeyResult: await resolveOutput(secrets.encryptionKey.result),
      dbAccessorMember: await resolveOutput(secrets.dbPasswordSecretAccessor.member),
      dbAccessorRole: await resolveOutput(secrets.dbPasswordSecretAccessor.role),
      encryptionAccessorMember: await resolveOutput(secrets.encryptionKeySecretAccessor.member),
      encryptionAccessorRole: await resolveOutput(secrets.encryptionKeySecretAccessor.role),
    };
  })) as {
    dbSecretId: string;
    dbSecretProject: string;
    dbVersionSecret: string;
    dbVersionData: string;
    encryptionSecretId: string;
    encryptionSecretProject: string;
    encryptionVersionSecret: string;
    encryptionVersionData: string;
    encryptionKeyResult: string;
    dbAccessorMember: string;
    dbAccessorRole: string;
    encryptionAccessorMember: string;
    encryptionAccessorRole: string;
  };
};

describe("createSecrets", () => {
  it("creates secrets and secret versions with expected configuration", async () => {
    const results = await runSecretsStack();

    expect(results.dbSecretId).toBe("n8n-service-db-password");
    expect(results.dbSecretProject).toBe("test-project");
    expect(results.dbVersionSecret).toBe("dbPasswordSecret-id");
    expect(results.dbVersionData).toBe("mock-db-password");

    expect(results.encryptionSecretId).toBe("n8n-service-encryption-key");
    expect(results.encryptionSecretProject).toBe("test-project");
    expect(results.encryptionVersionSecret).toBe("encryptionKeySecret-id");
    expect(results.encryptionVersionData).toBe("mock-encryption-key");
    expect(results.encryptionKeyResult).toBe("mock-encryption-key");

    const dbSecretResource = recordedResources.find((res) => res.type === "gcp:secretmanager/secret:Secret" && res.name === "dbPasswordSecret");
    expect(dbSecretResource).toBeDefined();
    expect(dbSecretResource!.inputs.secretId).toBe("n8n-service-db-password");
    expect(dbSecretResource!.inputs.replication.auto).toEqual({});
    const encryptionSecretResource = recordedResources.find(
      (res) => res.type === "gcp:secretmanager/secret:Secret" && res.name === "encryptionKeySecret"
    );
    expect(encryptionSecretResource).toBeDefined();
    expect(encryptionSecretResource!.inputs.secretId).toBe("n8n-service-encryption-key");
    expect(encryptionSecretResource!.inputs.replication.auto).toEqual({});

    const randomPasswordResource = recordedResources.find((res) => res.type === "random:index/randomPassword:RandomPassword");
    expect(randomPasswordResource).toBeDefined();
    expect(randomPasswordResource!.inputs.length).toBe(32);
    expect(randomPasswordResource!.inputs.special).toBe(false);
  });

  it("grants secret accessor roles to the provided service account", async () => {
    const results = await runSecretsStack();

    expect(results.dbAccessorRole).toBe("roles/secretmanager.secretAccessor");
    expect(results.dbAccessorMember).toBe("serviceAccount:n8n-service-account@test-project.iam.gserviceaccount.com");
    expect(results.encryptionAccessorRole).toBe("roles/secretmanager.secretAccessor");
    expect(results.encryptionAccessorMember).toBe("serviceAccount:n8n-service-account@test-project.iam.gserviceaccount.com");

    const dbAccessorResource = recordedResources.find(
      (res) => res.type === "gcp:secretmanager/secretIamMember:SecretIamMember" && res.name === "dbPasswordSecretAccessor"
    );
    expect(dbAccessorResource).toBeDefined();

    const encryptionAccessorResource = recordedResources.find(
      (res) => res.type === "gcp:secretmanager/secretIamMember:SecretIamMember" && res.name === "encryptionKeySecretAccessor"
    );
    expect(encryptionAccessorResource).toBeDefined();
  });
});
