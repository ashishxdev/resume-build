import { describe, expect, it } from "vitest";

import { loadEnvironment } from "./environment.js";

const productionBase = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "a-secure-production-secret-with-32-characters",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Make My Resume <auth@example.com>",
};

describe("loadEnvironment", () => {
  it("rejects the implicit in-memory auth store in production", () => {
    expect(() => loadEnvironment(productionBase)).toThrow(
      "Production requires AUTH_STORAGE=mongodb",
    );
  });

  it("rejects an explicitly configured in-memory auth store in production", () => {
    expect(() =>
      loadEnvironment({ ...productionBase, AUTH_STORAGE: "memory" }),
    ).toThrow("Production requires AUTH_STORAGE=mongodb");
  });

  it("accepts persistent authentication storage in production", () => {
    expect(
      loadEnvironment({
        ...productionBase,
        AUTH_STORAGE: "mongodb",
        MONGODB_URI: "mongodb://localhost:27017",
      }).AUTH_STORAGE,
    ).toBe("mongodb");
  });

  it("requires complete transactional email configuration", () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: "development",
        RESEND_API_KEY: "re_test_key",
      }),
    ).toThrow("Transactional email requires RESEND_API_KEY and EMAIL_FROM");
  });

  it("requires transactional email in production", () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: "production",
        AUTH_STORAGE: "mongodb",
        MONGODB_URI: "mongodb://localhost:27017",
        BETTER_AUTH_SECRET: "a-secure-production-secret-with-32-characters",
      }),
    ).toThrow("Production requires Resend transactional email configuration");
  });

  it("normalizes an explicit trusted proxy allowlist", () => {
    expect(
      loadEnvironment({
        TRUSTED_PROXY_IPS: " loopback, 10.0.0.0/8, ,192.0.2.10 ",
      }).TRUSTED_PROXY_IPS,
    ).toEqual(["loopback", "10.0.0.0/8", "192.0.2.10"]);
  });
});
