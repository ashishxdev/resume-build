import type { Environment } from "../../config/environment.js";
import type { TailoringGenerator } from "../../modules/tailoring/tailoring-generator.js";
import { createGeminiTailoringGenerator } from "./gemini-tailoring-generator.js";

export function createTailoringGenerator(
  environment: Environment,
): TailoringGenerator | null {
  if (environment.AI_PROVIDER !== "gemini" || !environment.AI_PROVIDER_API_KEY)
    return null;
  return createGeminiTailoringGenerator({
    apiKey: environment.AI_PROVIDER_API_KEY,
    model: environment.AI_MODEL,
  });
}
