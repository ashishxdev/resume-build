import type { Environment } from "../../config/environment.js";
import type { JobDescriptionAnalyzer } from "../../modules/job-descriptions/job-description-analyzer.js";
import { createGeminiJobDescriptionAnalyzer } from "./gemini-job-description-analyzer.js";

export function createJobDescriptionAnalyzer(
  environment: Environment,
): JobDescriptionAnalyzer | null {
  if (
    environment.AI_PROVIDER !== "gemini" ||
    !environment.AI_PROVIDER_API_KEY
  ) {
    return null;
  }
  return createGeminiJobDescriptionAnalyzer({
    apiKey: environment.AI_PROVIDER_API_KEY,
    model: environment.AI_MODEL,
  });
}
