import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@make-my-resume/contracts",
    "@make-my-resume/resume-renderer",
  ],
};

export default nextConfig;
