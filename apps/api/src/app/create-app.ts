import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";

import type { Environment } from "../config/environment.js";
import { createAuthInfoRouter } from "../http/routes/auth.js";
import { healthRouter } from "../http/routes/health.js";
import type { Auth } from "../infrastructure/auth/auth.js";
import { createLogger } from "../shared/logging/logger.js";

function normalizeForwardedHeader(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value?.split(",");
  return values?.at(-1)?.trim();
}

export function createApp(
  environment: Environment,
  auth: Auth,
  googleEnabled = false,
) {
  const app = express();
  const logger = createLogger(environment);

  app.disable("x-powered-by");
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      origin: environment.BETTER_AUTH_TRUSTED_ORIGINS,
      credentials: true,
    }),
  );
  app.use("/api/auth", (request, _response, next) => {
    const forwardedProtocol = normalizeForwardedHeader(
      request.headers["x-forwarded-proto"],
    );

    if (forwardedProtocol) {
      request.headers["x-forwarded-proto"] = forwardedProtocol;
    }

    next();
  });
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use(createAuthInfoRouter(auth, googleEnabled));

  return app;
}
