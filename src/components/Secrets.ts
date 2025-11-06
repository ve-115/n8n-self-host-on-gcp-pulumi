import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as random from "@pulumi/random";

import { SecretsResources } from "../types/components.types";

interface CreateSecretsArgs {
  project: string;
  serviceName: string;
  dbPassword: pulumi.Output<string>;
  serviceAccount: gcp.serviceaccount.Account;
  secretManagerApi: gcp.projects.Service;
}

export const createSecrets = ({ project, serviceName, dbPassword, serviceAccount, secretManagerApi }: CreateSecretsArgs): SecretsResources => {
  const dbPasswordSecret = new gcp.secretmanager.Secret(
    "dbPasswordSecret",
    {
      project,
      secretId: `${serviceName}-db-password`,
      replication: {
        auto: {},
      },
    },
    { dependsOn: [secretManagerApi] }
  );

  const dbPasswordSecretVersion = new gcp.secretmanager.SecretVersion("dbPasswordSecretVersion", {
    secret: dbPasswordSecret.id,
    secretData: dbPassword,
  });

  const encryptionKey = new random.RandomPassword("n8nEncryptionKey", {
    length: 32,
    special: false,
  });

  const encryptionKeySecret = new gcp.secretmanager.Secret(
    "encryptionKeySecret",
    {
      project,
      secretId: `${serviceName}-encryption-key`,
      replication: {
        auto: {},
      },
    },
    { dependsOn: [secretManagerApi] }
  );

  const encryptionKeySecretVersion = new gcp.secretmanager.SecretVersion("encryptionKeySecretVersion", {
    secret: encryptionKeySecret.id,
    secretData: encryptionKey.result,
  });

  const dbPasswordSecretAccessor = new gcp.secretmanager.SecretIamMember(
    "dbPasswordSecretAccessor",
    {
      project: dbPasswordSecret.project,
      secretId: dbPasswordSecret.secretId,
      role: "roles/secretmanager.secretAccessor",
      member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
    },
    { dependsOn: [dbPasswordSecret, serviceAccount] }
  );

  const encryptionKeySecretAccessor = new gcp.secretmanager.SecretIamMember(
    "encryptionKeySecretAccessor",
    {
      project: encryptionKeySecret.project,
      secretId: encryptionKeySecret.secretId,
      role: "roles/secretmanager.secretAccessor",
      member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
    },
    { dependsOn: [encryptionKeySecret, serviceAccount] }
  );

  return {
    dbPasswordSecret,
    dbPasswordSecretVersion,
    encryptionKeySecret,
    encryptionKeySecretVersion,
    encryptionKey,
    dbPasswordSecretAccessor,
    encryptionKeySecretAccessor,
  };
};
