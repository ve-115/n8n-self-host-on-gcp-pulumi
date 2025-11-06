import * as pulumi from "@pulumi/pulumi";
import { requireConfigBoolean, requireConfigNumber, requireConfigString } from "../config.utils";

type MockConfig = Partial<Record<"get" | "getNumber" | "getBoolean", jest.Mock>>;

const buildConfig = (overrides: MockConfig): pulumi.Config => {
  const defaults: MockConfig = {
    get: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
  };

  return {
    ...defaults,
    ...overrides,
  } as unknown as pulumi.Config;
};

describe("requireConfigString", () => {
  it("returns trimmed config value when present", () => {
    const config = buildConfig({
      get: jest.fn().mockReturnValue("  some-value  "),
    });

    const result = requireConfigString(config, "testKey");

    expect(result).toBe("some-value");
    expect(config.get).toHaveBeenCalledWith("testKey");
  });

  it("throws when config value is missing or empty", () => {
    const config = buildConfig({
      get: jest.fn().mockReturnValue(undefined),
    });

    expect(() => requireConfigString(config, "missingKey")).toThrow("Set n8n-self-host-on-gcp:missingKey via Pulumi config.");
  });
});

describe("requireConfigNumber", () => {
  it("returns numeric config when present", () => {
    const config = buildConfig({
      getNumber: jest.fn().mockReturnValue(0),
    });

    const result = requireConfigNumber(config, "zeroKey");

    expect(result).toBe(0);
    expect(config.getNumber).toHaveBeenCalledWith("zeroKey");
  });

  it("throws when numeric config is undefined", () => {
    const config = buildConfig({
      getNumber: jest.fn().mockReturnValue(undefined),
    });

    expect(() => requireConfigNumber(config, "missingNumber")).toThrow("Set numeric config n8n-self-host-on-gcp:missingNumber.");
  });
});

describe("requireConfigBoolean", () => {
  it("returns boolean config when present", () => {
    const config = buildConfig({
      getBoolean: jest.fn().mockReturnValue(false),
    });

    const result = requireConfigBoolean(config, "boolKey");

    expect(result).toBe(false);
    expect(config.getBoolean).toHaveBeenCalledWith("boolKey");
  });

  it("throws when boolean config is undefined", () => {
    const config = buildConfig({
      getBoolean: jest.fn().mockReturnValue(undefined),
    });

    expect(() => requireConfigBoolean(config, "missingBool")).toThrow("Set boolean config n8n-self-host-on-gcp:missingBool.");
  });
});
