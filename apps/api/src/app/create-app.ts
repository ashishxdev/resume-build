import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";

import type { Environment } from "../config/environment.js";
import { createAuthInfoRouter } from "../http/routes/auth.js";
import { healthRouter } from "../http/routes/health.js";
import {
  createResumeImportRouter,
  type ResumeImportServices,
} from "../http/routes/resume-imports.js";
import { createResumeVerificationRouter } from "../http/routes/resume-verification.js";
import {
  createResumeVersionRouter,
  type ResumeVersionRouteServices,
} from "../http/routes/resume-versions.js";
import {
  createJobDescriptionRouter,
  type JobDescriptionServices,
} from "../http/routes/job-descriptions.js";
import type { Auth } from "../infrastructure/auth/auth.js";
import {
  createTailoringRouter,
  type TailoringRouteServices,
} from "../http/routes/tailoring.js";
import { createLogger } from "../shared/logging/logger.js";

const betterAuthClientIpHeader = "x-make-my-resume-client-ip";

function normalizeForwardedHeader(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value?.split(",");
  return values?.at(-1)?.trim();
}

export function createApp(
  environment: Environment,
  auth: Auth,
  googleEnabled = false,
  resumeImportServices?: ResumeImportServices,
  jobDescriptionServices?: JobDescriptionServices,
  tailoringServices?: TailoringRouteServices,
  resumeVersionServices?: ResumeVersionRouteServices,
) {
  const app = express();
  const logger = createLogger(environment);

  app.disable("x-powered-by");
  if (environment.TRUSTED_PROXY_IPS.length > 0) {
    app.set("trust proxy", environment.TRUSTED_PROXY_IPS);
  }
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

    // Better Auth receives a Fetch Request rather than the Express request, so
    // pass along the client IP that Express resolved using our trusted-proxy
    // configuration. Always overwrite the inbound header to prevent spoofing.
    request.headers[betterAuthClientIpHeader] =
      request.ip ?? request.socket.remoteAddress ?? "127.0.0.1";

    next();
  });
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use(createAuthInfoRouter(auth, googleEnabled));
  if (resumeImportServices) {
    app.use(createResumeImportRouter(auth, resumeImportServices));
    if (resumeImportServices.extractionRepository) {
      app.use(
        createResumeVerificationRouter(
          auth,
          resumeImportServices.extractionRepository,
        ),
      );
    }
  }
  if (jobDescriptionServices) {
    app.use(createJobDescriptionRouter(auth, jobDescriptionServices));
  }
  if (tailoringServices) {
    app.use(createTailoringRouter(auth, tailoringServices));
  }
  if (resumeVersionServices) {
    app.use(createResumeVersionRouter(auth, resumeVersionServices));
  }

  return app;
}
