import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./create-app.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";

const testEnvironment = {
  NODE_ENV: "test",
  PORT: 4000,
  LOG_LEVEL: "silent",
  WEB_ORIGIN: "http://localhost:3000",
  AUTH_STORAGE: "memory",
  MONGODB_URI: undefined,
  MONGODB_DATABASE: "make_my_resume_test",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_API_KEY: undefined,
  BETTER_AUTH_TRUSTED_ORIGINS: ["http://localhost:3000"],
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
} as const;

function createTestApp() {
  const authRuntime = createAuthRuntime(testEnvironment);
  return createApp(testEnvironment, authRuntime.auth, false);
}

describe("GET /health", () => {
  it("reports that the API is healthy", async () => {
    const response = await request(createTestApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "make-my-resume-api",
    });
  });
});

describe("authentication", () => {
  it("creates a session and exposes only the authenticated user", async () => {
    const app = createTestApp();
    const agent = request.agent(app);

    const signUpResponse = await agent
      .post("/api/auth/sign-up/email")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({
        name: "Alex Mercer",
        email: "alex@example.com",
        password: "strong-password-123",
      });

    expect(signUpResponse.status).toBe(200);

    const meResponse = await agent.get("/api/v1/me");

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user).toMatchObject({
      name: "Alex Mercer",
      email: "alex@example.com",
    });
    expect(meResponse.body.user).not.toHaveProperty("password");
  });

  it("rejects unauthenticated access to the current user", async () => {
    const response = await request(createTestApp()).get("/api/v1/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
