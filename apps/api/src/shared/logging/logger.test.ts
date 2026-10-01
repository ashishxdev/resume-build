import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("redacts request credentials and response session cookies", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ LOG_LEVEL: "info" }, destination);

    logger.info({
      req: {
        headers: {
          authorization: "Bearer private-token",
          cookie: "session=private-cookie",
        },
      },
      res: {
        headers: {
          "set-cookie": ["session=private-response-cookie; HttpOnly"],
        },
      },
    });

    expect(output).not.toContain("private-token");
    expect(output).not.toContain("private-cookie");
    expect(output).not.toContain("private-response-cookie");
    expect(output.match(/\[REDACTED\]/g)).toHaveLength(3);
  });
});
