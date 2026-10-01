import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import type { NextConfig } from "next";

for (const environmentPath of [
  new URL("../../.env.local", import.meta.url),
  new URL("../../.env", import.meta.url),
]) {
  if (existsSync(environmentPath)) loadEnvFile(environmentPath);
}

const nextConfig: NextConfig = {
  transpilePackages: [
    "@make-my-resume/contracts",
    "@make-my-resume/resume-renderer",
  ],
};

export default nextConfig;
