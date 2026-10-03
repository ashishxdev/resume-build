import type { ResumeClaim } from "@make-my-resume/contracts";

import type { ExtractedPage } from "./document-text-extractor.js";

export interface ResumeAiParsingResult {
  claims: ResumeClaim[];
  provider: string;
  model: string;
  promptVersion: string;
}

export interface ResumeAiParser {
  parse(pages: ExtractedPage[]): Promise<ResumeAiParsingResult>;
}
