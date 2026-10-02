import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    AUTH_STORAGE: z.enum(["memory", "mongodb"]).default("memory"),
    MONGODB_URI: z.string().min(1).optional(),
    MONGODB_DATABASE: z.string().min(1).default("make_my_resume"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .default("development-only-secret-change-before-production"),
    BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
    BETTER_AUTH_API_KEY: z.string().min(1).optional(),
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    TRUSTED_PROXY_IPS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((address) => address.trim())
          .filter(Boolean),
      ),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_REPLY_TO: z.email().optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === "production" &&
      environment.AUTH_STORAGE !== "mongodb"
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_STORAGE"],
        message: "Production requires AUTH_STORAGE=mongodb",
      });
    }

    if (environment.AUTH_STORAGE === "mongodb" && !environment.MONGODB_URI) {
      context.addIssue({
        code: "custom",
        path: ["MONGODB_URI"],
        message: "MONGODB_URI is required when AUTH_STORAGE is mongodb",
      });
    }

    if (
      (environment.GOOGLE_CLIENT_ID && !environment.GOOGLE_CLIENT_SECRET) ||
      (!environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET)
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: "Google OAuth requires both client ID and client secret",
      });
    }

    if (
      (environment.RESEND_API_KEY && !environment.EMAIL_FROM) ||
      (!environment.RESEND_API_KEY && environment.EMAIL_FROM)
    ) {
      context.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Transactional email requires RESEND_API_KEY and EMAIL_FROM",
      });
    }

    if (
      environment.NODE_ENV === "production" &&
      (!environment.RESEND_API_KEY || !environment.EMAIL_FROM)
    ) {
      context.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Production requires Resend transactional email configuration",
      });
    }

    if (
      environment.NODE_ENV === "production" &&
      environment.BETTER_AUTH_SECRET.startsWith("development-only")
    ) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "A production authentication secret is required",
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(source);
}
