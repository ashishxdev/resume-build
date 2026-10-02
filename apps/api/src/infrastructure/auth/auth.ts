import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

import type { Environment } from "../../config/environment.js";
import { createLogger } from "../../shared/logging/logger.js";
import {
  createTransactionalEmailService,
  type TransactionalEmailService,
} from "../email/email-service.js";
import { passwordResetTokenStatus } from "./password-reset-token-status.js";

export function createAuthRuntime(
  environment: Environment,
  emailService: TransactionalEmailService = createTransactionalEmailService(
    environment,
  ),
) {
  const logger = createLogger(environment);
  const mongoClient =
    environment.AUTH_STORAGE === "mongodb" && environment.MONGODB_URI
      ? new MongoClient(environment.MONGODB_URI)
      : undefined;

  const database = mongoClient
    ? mongodbAdapter(mongoClient.db(environment.MONGODB_DATABASE), {
        client: mongoClient,
      })
    : memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
      });

  const googleEnabled = Boolean(
    environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET,
  );

  const auth = betterAuth({
    appName: "Make My Resume",
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    trustedOrigins: environment.BETTER_AUTH_TRUSTED_ORIGINS,
    database,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        void emailService
          .sendPasswordReset({
            name: user.name,
            resetUrl: url,
            to: user.email,
          })
          .catch(() => {
            logger.error(
              { provider: "resend" },
              "Password reset email delivery failed",
            );
          });
      },
    },
    rateLimit: {
      enabled: true,
      storage: environment.AUTH_STORAGE === "mongodb" ? "database" : "memory",
    },
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: environment.GOOGLE_CLIENT_ID!,
            clientSecret: environment.GOOGLE_CLIENT_SECRET!,
          },
        }
      : undefined,
    plugins: [
      passwordResetTokenStatus(),
      ...(environment.BETTER_AUTH_API_KEY
        ? [dash({ apiKey: environment.BETTER_AUTH_API_KEY })]
        : []),
    ],
    advanced: {
      database: {
        joins: true,
      },
      ipAddress: {
        ipAddressHeaders: ["x-make-my-resume-client-ip"],
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: environment.NODE_ENV === "production",
        sameSite: environment.NODE_ENV === "production" ? "none" : "lax",
      },
    },
  });

  return {
    auth,
    googleEnabled,
    close: async () => {
      await mongoClient?.close();
    },
  };
}

export type Auth = ReturnType<typeof createAuthRuntime>["auth"];
