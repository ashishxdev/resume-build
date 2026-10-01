import { createApp } from "../app/create-app.js";
import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";
import { createLogger } from "../shared/logging/logger.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);
const authRuntime = createAuthRuntime(environment);
const app = createApp(environment, authRuntime.auth, authRuntime.googleEnabled);

const server = app.listen(environment.PORT, () => {
  logger.info({ port: environment.PORT }, "API listening");
});

server.ref();

function shutdown(signal: string) {
  logger.info({ signal }, "API shutting down");
  server.close(async (error) => {
    if (error) {
      logger.error({ error }, "API shutdown failed");
      process.exitCode = 1;
    }
    await authRuntime.close();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
