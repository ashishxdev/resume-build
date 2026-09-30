import { z } from "zod";

const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:4000"),
});

export const clientEnvironment = clientEnvironmentSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
