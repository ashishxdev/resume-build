import type { Environment } from "../../config/environment.js";
import type { ResumeAiParser } from "../../modules/resumes/resume-ai-parser.js";
import { createGeminiResumeParser } from "./gemini-resume-parser.js";

export function createResumeAiParser(
  environment: Environment,
): ResumeAiParser | null {
  if (
    environment.AI_PROVIDER !== "gemini" ||
    !environment.AI_PROVIDER_API_KEY
  ) {
    return null;
  }

  return createGeminiResumeParser({
    apiKey: environment.AI_PROVIDER_API_KEY,
    model: environment.AI_MODEL,
  });
}
