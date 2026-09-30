import pino from "pino";

import type { Environment } from "../../config/environment.js";

export function createLogger(environment: Pick<Environment, "LOG_LEVEL">) {
  return pino({
    level: environment.LOG_LEVEL,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      censor: "[REDACTED]",
    },
  });
}
