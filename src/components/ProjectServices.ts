import * as gcp from "@pulumi/gcp";

import { ProjectServicesResources } from "../types/components.types";

export const enableCoreServices = (project: string): ProjectServicesResources => {
  const runApi = new gcp.projects.Service("runApi", {
    project,
    service: "run.googleapis.com",
    disableOnDestroy: false,
  });

  const sqlAdminApi = new gcp.projects.Service("sqlAdminApi", {
    project,
    service: "sqladmin.googleapis.com",
    disableOnDestroy: false,
  });

  const secretManagerApi = new gcp.projects.Service("secretManagerApi", {
    project,
    service: "secretmanager.googleapis.com",
    disableOnDestroy: false,
  });

  const resourceManagerApi = new gcp.projects.Service("resourceManagerApi", {
    project,
    service: "cloudresourcemanager.googleapis.com",
    disableOnDestroy: false,
  });

  return {
    runApi,
    sqlAdminApi,
    secretManagerApi,
    resourceManagerApi,
  };
};
