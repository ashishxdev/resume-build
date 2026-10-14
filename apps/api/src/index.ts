import express from "express";

import { loadEnvironment } from "./config/environment.js";
import { loadLocalEnvironmentFiles } from "./config/load-local-environment.js";
import { createApiRuntime } from "./runtime/create-api-runtime.js";

loadLocalEnvironmentFiles();

export const environment = loadEnvironment();
const app = express();
export const apiRuntime = createApiRuntime(environment, {
  app,
  // Vercel overwrites this header at its edge, so it is safe to trust only
  // when the runtime explicitly identifies itself as a Vercel deployment.
  trustVercelProxyHeaders: process.env.VERCEL === "1",
});

export default app;
