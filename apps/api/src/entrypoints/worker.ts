import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createLogger } from "../shared/logging/logger.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);

logger.info("Worker started");

const keepAlive = setInterval(() => {
  logger.debug("Worker idle");
}, 30_000);

function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  clearInterval(keepAlive);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
