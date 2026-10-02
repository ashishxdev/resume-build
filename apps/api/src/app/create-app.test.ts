import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./create-app.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";
import type {
  PasswordResetEmail,
  TransactionalEmailService,
} from "../infrastructure/email/email-service.js";

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
  TRUSTED_PROXY_IPS: [] as string[],
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  RESEND_API_KEY: undefined,
  EMAIL_FROM: undefined,
  EMAIL_REPLY_TO: undefined,
} as const;

function createTestApp(emailService?: TransactionalEmailService) {
  const authRuntime = createAuthRuntime(testEnvironment, emailService);
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

  it("resets a password with a single-use token and revokes sessions", async () => {
    const sentMessages: PasswordResetEmail[] = [];
    const app = createTestApp({
      async sendPasswordReset(message) {
        sentMessages.push(message);
      },
    });
    const agent = request.agent(app);

    await agent
      .post("/api/auth/sign-up/email")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({
        name: "Alex Mercer",
        email: "alex@example.com",
        password: "old-password-123",
      })
      .expect(200);

    await request(app)
      .post("/api/auth/request-password-reset")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({
        email: "alex@example.com",
        redirectTo: `${testEnvironment.WEB_ORIGIN}/reset-password`,
      })
      .expect(200);

    expect(sentMessages).toHaveLength(1);
    const resetLink = new URL(sentMessages[0]!.resetUrl);
    const callback = await request(app).get(
      `${resetLink.pathname}${resetLink.search}`,
    );

    expect(callback.status).toBe(302);
    const browserRedirect = new URL(callback.headers.location!);
    const token = browserRedirect.searchParams.get("token");
    expect(token).toBeTruthy();

    await request(app)
      .post("/api/auth/reset-password")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({ newPassword: "new-password-456", token })
      .expect(200);

    await agent.get("/api/v1/me").expect(401);

    await request(app)
      .post("/api/auth/reset-password")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({ newPassword: "another-password-789", token })
      .expect(400);

    await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({ email: "alex@example.com", password: "old-password-123" })
      .expect(401);

    await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({ email: "alex@example.com", password: "new-password-456" })
      .expect(200);
  });

  it("uses the same reset response for unknown email addresses", async () => {
    const sentMessages: PasswordResetEmail[] = [];
    const app = createTestApp({
      async sendPasswordReset(message) {
        sentMessages.push(message);
      },
    });

    const response = await request(app)
      .post("/api/auth/request-password-reset")
      .set("Origin", testEnvironment.WEB_ORIGIN)
      .send({
        email: "missing@example.com",
        redirectTo: `${testEnvironment.WEB_ORIGIN}/reset-password`,
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "If this email exists in our system, check your email for the reset link",
    );
    expect(sentMessages).toHaveLength(0);
  });

  it("rate limits repeated password reset requests", async () => {
    const app = createTestApp({
      async sendPasswordReset() {},
    });

    const statuses: number[] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/request-password-reset")
        .set("Origin", testEnvironment.WEB_ORIGIN)
        .send({
          email: "missing@example.com",
          redirectTo: `${testEnvironment.WEB_ORIGIN}/reset-password`,
        });

      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
  });
});
