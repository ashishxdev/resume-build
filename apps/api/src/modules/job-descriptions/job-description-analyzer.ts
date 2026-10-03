import type {
  JobDescriptionAnalysis,
  ResumeClaim,
} from "@make-my-resume/contracts";

export interface AnalyzeJobDescriptionInput {
  rawText: string;
  resumeClaims: ResumeClaim[];
}

export interface JobDescriptionAnalysisResult {
  analysis: JobDescriptionAnalysis;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface JobDescriptionAnalyzer {
  analyze(
    input: AnalyzeJobDescriptionInput,
  ): Promise<JobDescriptionAnalysisResult>;
}
