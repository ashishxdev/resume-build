import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./create-app.js";

const testEnvironment = {
  NODE_ENV: "test",
  PORT: 4000,
  LOG_LEVEL: "silent",
  WEB_ORIGIN: "http://localhost:3000",
} as const;

describe("GET /health", () => {
  it("reports that the API is healthy", async () => {
    const response = await request(createApp(testEnvironment)).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "make-my-resume-api",
    });
  });
});
