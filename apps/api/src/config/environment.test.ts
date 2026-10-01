import { describe, expect, it } from "vitest";

import { loadEnvironment } from "./environment.js";

const productionBase = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "a-secure-production-secret-with-32-characters",
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
});
