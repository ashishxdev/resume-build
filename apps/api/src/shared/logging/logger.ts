import pino from "pino";

import type { Environment } from "../../config/environment.js";
import type { DestinationStream } from "pino";

export function createLogger(
  environment: Pick<Environment, "LOG_LEVEL">,
  destination?: DestinationStream,
) {
  return pino(
    {
      level: environment.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          'res.headers["set-cookie"]',
        ],
        censor: "[REDACTED]",
      },
    },
    destination,
  );
}
