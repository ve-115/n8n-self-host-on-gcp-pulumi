import * as pulumi from "@pulumi/pulumi";

export const requireConfigString = (config: pulumi.Config, key: string): string => {
  const value = config.get(key)?.trim();
  if (!value) {
    throw new Error(`Set n8n-self-host-on-gcp:${key} via Pulumi config.`);
  }
  return value;
};

export const requireConfigNumber = (config: pulumi.Config, key: string): number => {
  const value = config.getNumber(key);
  if (value === undefined) {
    throw new Error(`Set numeric config n8n-self-host-on-gcp:${key}.`);
  }
  return value;
};

export const requireConfigBoolean = (config: pulumi.Config, key: string): boolean => {
  const value = config.getBoolean(key);
  if (value === undefined) {
    throw new Error(`Set boolean config n8n-self-host-on-gcp:${key}.`);
  }
  return value;
};
