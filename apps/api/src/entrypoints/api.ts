import app, { apiRuntime, environment } from "../index.js";
import { createLogger } from "../shared/logging/logger.js";

const logger = createLogger(environment);
const server = app.listen(environment.PORT, () => {
  logger.info({ port: environment.PORT }, "API listening");
});

server.ref();

let isShuttingDown = false;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "API shutting down");
  server.close(async (error) => {
    if (error) {
      logger.error({ error }, "API shutdown failed");
      process.exitCode = 1;
    }

    await apiRuntime.close();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
