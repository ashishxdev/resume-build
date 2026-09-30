import { createApp } from "../app/create-app.js";
import { loadEnvironment } from "../config/environment.js";
import { createLogger } from "../shared/logging/logger.js";

const environment = loadEnvironment();
const logger = createLogger(environment);
const app = createApp(environment);

const server = app.listen(environment.PORT, () => {
  logger.info({ port: environment.PORT }, "API listening");
});

server.ref();

function shutdown(signal: string) {
  logger.info({ signal }, "API shutting down");
  server.close((error) => {
    if (error) {
      logger.error({ error }, "API shutdown failed");
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
