import type {
  JobDescriptionAnalysis,
  ResumeClaim,
  TailoringSuggestion,
} from "@make-my-resume/contracts";

export interface GenerateTailoringInput {
  rawJobDescription: string;
  analysis: JobDescriptionAnalysis;
  evidenceClaims: ResumeClaim[];
}

export interface TailoringGenerationResult {
  suggestions: TailoringSuggestion[];
  provider: string;
  model: string;
  promptVersion: string;
}

export interface TailoringGenerator {
  generate(input: GenerateTailoringInput): Promise<TailoringGenerationResult>;
}
