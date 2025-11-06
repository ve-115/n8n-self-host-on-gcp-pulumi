import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { ServiceAccountResources } from "../types/components.types";

interface CreateServiceAccountArgs {
  project: string;
  accountId: string;
  displayName: string;
  dependsOn?: pulumi.Resource[];
}

export const createServiceAccount = ({ project, accountId, displayName, dependsOn }: CreateServiceAccountArgs): ServiceAccountResources => {
  const account = new gcp.serviceaccount.Account(
    "n8nServiceAccount",
    {
      project,
      accountId,
      displayName,
    },
    dependsOn ? { dependsOn } : undefined
  );

  const sqlClientRole = new gcp.projects.IAMMember(
    "sqlClientRole",
    {
      project,
      role: "roles/cloudsql.client",
      member: pulumi.interpolate`serviceAccount:${account.email}`,
    },
    { dependsOn: [account] }
  );

  return {
    account,
    sqlClientRole,
  };
};
