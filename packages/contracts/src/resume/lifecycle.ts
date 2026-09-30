import { z } from "zod";

export const resumeLifecycleStateSchema = z.enum([
  "import_draft",
  "verified_baseline",
  "working_draft",
  "historical_version",
]);

export type ResumeLifecycleState = z.infer<typeof resumeLifecycleStateSchema>;
