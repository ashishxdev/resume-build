import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const localEnvironmentPaths = [
  new URL("../../../../.env.local", import.meta.url),
  new URL("../../../../.env", import.meta.url),
];

export function loadLocalEnvironmentFiles() {
  for (const environmentPath of localEnvironmentPaths) {
    if (existsSync(environmentPath)) {
      loadEnvFile(environmentPath);
    }
  }
}
