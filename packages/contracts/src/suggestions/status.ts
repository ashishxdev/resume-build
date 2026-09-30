import { z } from "zod";

export const suggestionStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "superseded",
]);

export type SuggestionStatus = z.infer<typeof suggestionStatusSchema>;
