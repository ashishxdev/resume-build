import cors from "cors";
import express, { type Express } from "express";
import {
  contentSecurityPolicy,
  crossOriginOpenerPolicy,
  crossOriginResourcePolicy,
  originAgentCluster,
  referrerPolicy,
  strictTransportSecurity,
  xContentTypeOptions,
  xDnsPrefetchControl,
  xDownloadOptions,
  xFrameOptions,
  xPermittedCrossDomainPolicies,
  xPoweredBy,
  xXssProtection,
} from "helmet";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";

import type { Environment } from "../config/environment.js";
import { createAuthRouter } from "../http/routes/auth.js";
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
  createResumeShareRouter,
  type ResumeShareRouteServices,
} from "../http/routes/resume-shares.js";
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

export function resolveClientIp({
  trustVercelProxyHeaders,
  vercelForwardedFor,
  resolvedIp,
  remoteAddress,
}: {
  trustVercelProxyHeaders: boolean;
  vercelForwardedFor: string | string[] | undefined;
  resolvedIp: string | undefined;
  remoteAddress: string | undefined;
}) {
  if (trustVercelProxyHeaders) {
    const vercelClientIp = normalizeForwardedHeader(vercelForwardedFor);
    if (vercelClientIp) return vercelClientIp;
  }

  return resolvedIp ?? remoteAddress ?? "127.0.0.1";
}

export function redactSensitiveRequestUrl(value: string) {
  return value.replace(
    /(\/api\/v1\/public\/resumes\/)[A-Za-z0-9_-]+/g,
    "$1[REDACTED]",
  );
}

export function createApp(
  environment: Environment,
  auth: Auth,
  resumeImportServices?: ResumeImportServices,
  jobDescriptionServices?: JobDescriptionServices,
  tailoringServices?: TailoringRouteServices,
  resumeVersionServices?: ResumeVersionRouteServices,
  resumeShareServices?: ResumeShareRouteServices,
  options: { app?: Express; trustVercelProxyHeaders?: boolean } = {},
) {
  const app = options.app ?? express();
  const logger = createLogger(environment);

  app.disable("x-powered-by");
  if (environment.TRUSTED_PROXY_IPS.length > 0) {
    app.set("trust proxy", environment.TRUSTED_PROXY_IPS);
  }
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(request: unknown) {
          if (!request || typeof request !== "object") return request;
          const serialized = request as Record<string, unknown>;
          return {
            ...serialized,
            url:
              typeof serialized.url === "string"
                ? redactSensitiveRequestUrl(serialized.url)
                : serialized.url,
          };
        },
      },
    }),
  );
  // Register Helmet's default middleware individually. This preserves the
  // default security headers without relying on its CJS/ESM default export,
  // which Vercel's Express builder can type as a non-callable module object.
  app.use(contentSecurityPolicy());
  app.use(crossOriginOpenerPolicy());
  app.use(crossOriginResourcePolicy());
  app.use(originAgentCluster());
  app.use(referrerPolicy());
  app.use(strictTransportSecurity());
  app.use(xContentTypeOptions());
  app.use(xDnsPrefetchControl());
  app.use(xDownloadOptions());
  app.use(xFrameOptions());
  app.use(xPermittedCrossDomainPolicies());
  app.use(xPoweredBy());
  app.use(xXssProtection());
  app.use(
    cors({
      origin: environment.BETTER_AUTH_TRUSTED_ORIGINS,
      credentials: true,
      exposedHeaders: ["Content-Disposition", "Content-Length"],
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
    request.headers[betterAuthClientIpHeader] = resolveClientIp({
      trustVercelProxyHeaders: options.trustVercelProxyHeaders === true,
      vercelForwardedFor: request.headers["x-vercel-forwarded-for"],
      resolvedIp: request.ip,
      remoteAddress: request.socket.remoteAddress,
    });

    next();
  });
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use(createAuthRouter(auth));
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
  if (resumeShareServices) {
    app.use(createResumeShareRouter(auth, resumeShareServices));
  }

  return app;
}
