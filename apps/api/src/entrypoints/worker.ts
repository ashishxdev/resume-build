import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createWorkerRuntime } from "../runtime/create-worker-runtime.js";
import { createLogger } from "../shared/logging/logger.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);
const workerRuntime = createWorkerRuntime(environment);
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Worker shutting down");
  await workerRuntime.close();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
