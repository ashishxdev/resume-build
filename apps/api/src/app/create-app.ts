import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import type { Environment } from "../config/environment.js";
import { healthRouter } from "../http/routes/health.js";
import { createLogger } from "../shared/logging/logger.js";

export function createApp(environment: Environment) {
  const app = express();
  const logger = createLogger(environment);

  app.disable("x-powered-by");
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      origin: environment.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);

  return app;
}
