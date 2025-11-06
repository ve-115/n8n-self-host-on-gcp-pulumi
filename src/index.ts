import deploymentConfig from "./config";
import { createCloudRunService, createDatabase, createSecrets, createServiceAccount, enableCoreServices } from "./components";

const {
  gcp: { project, region },
  db,
  cloudRun,
  timezone,
  allowUnauthenticated,
} = deploymentConfig;

const services = enableCoreServices(project);

const serviceAccount = createServiceAccount({
  project,
  accountId: cloudRun.serviceAccountName,
  displayName: "n8n Service Account for Cloud Run",
  dependsOn: [services.resourceManagerApi],
});

const database = createDatabase({
  project,
  region,
  serviceName: cloudRun.serviceName,
  dbConfig: db,
  sqlAdminApi: services.sqlAdminApi,
});

const secrets = createSecrets({
  project,
  serviceName: cloudRun.serviceName,
  dbPassword: database.password.result,
  serviceAccount: serviceAccount.account,
  secretManagerApi: services.secretManagerApi,
});

const cloudRunService = createCloudRunService({
  project,
  region,
  timezone,
  cloudRunConfig: cloudRun,
  dbConfig: db,
  dbInstance: database.instance,
  serviceAccountEmail: serviceAccount.account.email,
  secrets,
  allowUnauthenticated,
  dependencies: [
    services.runApi,
    services.resourceManagerApi,
    services.secretManagerApi,
    serviceAccount.sqlClientRole,
    secrets.dbPasswordSecretAccessor,
    secrets.encryptionKeySecretAccessor,
  ],
});

export const cloudRunServiceUrl = cloudRunService.serviceUrl;
export const cloudSqlConnectionName = database.instance.connectionName;
export const n8nServiceAccountEmail = serviceAccount.account.email;
