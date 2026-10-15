import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createApiRuntime } from "../runtime/create-api-runtime.js";
import { createWorkerRuntime } from "../runtime/create-worker-runtime.js";
import { createLogger } from "../shared/logging/logger.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);
const apiRuntime = createApiRuntime(environment);
const workerRuntime = createWorkerRuntime(environment);
const server = apiRuntime.app.listen(environment.PORT, "0.0.0.0", () => {
  logger.info(
    { host: "0.0.0.0", port: environment.PORT },
    "Render API and worker listening",
  );
});

server.ref();

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Render API and worker shutting down");

  await workerRuntime.close();
  await new Promise<void>((resolve) => {
    server.close((error) => {
      if (error) {
        logger.error({ error }, "Render HTTP server shutdown failed");
        process.exitCode = 1;
      }
      resolve();
    });
  });
  await apiRuntime.close();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
