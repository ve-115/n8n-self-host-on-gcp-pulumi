import * as gcp from "@pulumi/gcp";
import * as random from "@pulumi/random";

import { DatabaseConfig } from "../types/config.types";
import { DatabaseResources } from "../types/components.types";

interface CreateDatabaseArgs {
  project: string;
  region: string;
  serviceName: string;
  dbConfig: DatabaseConfig;
  sqlAdminApi: gcp.projects.Service;
}

export const createDatabase = ({ project, region, serviceName, dbConfig, sqlAdminApi }: CreateDatabaseArgs): DatabaseResources => {
  const instanceName = `${serviceName}-db`;

  const password = new random.RandomPassword("dbPassword", {
    length: 16,
    special: true,
    minUpper: 1,
    minLower: 1,
    minNumeric: 1,
    minSpecial: 1,
    keepers: {
      dbInstance: instanceName,
      dbUser: dbConfig.user,
    },
  });

  const instance = new gcp.sql.DatabaseInstance(
    "n8nDbInstance",
    {
      name: instanceName,
      project,
      region,
      databaseVersion: dbConfig.version,
      settings: {
        tier: dbConfig.tier,
        availabilityType: "ZONAL",
        diskType: "PD_HDD",
        diskSize: dbConfig.storageSize,
        backupConfiguration: {
          enabled: false,
        },
      },
      deletionProtection: false,
    },
    { dependsOn: [sqlAdminApi] }
  );

  const database = new gcp.sql.Database("n8nDatabase", {
    name: dbConfig.name,
    instance: instance.name,
    project,
  });

  const user = new gcp.sql.User("n8nUser", {
    name: dbConfig.user,
    instance: instance.name,
    password: password.result,
    project,
  });

  return {
    password,
    instance,
    database,
    user,
  };
};
