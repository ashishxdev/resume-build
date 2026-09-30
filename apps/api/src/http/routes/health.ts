import { healthResponseSchema } from "@make-my-resume/contracts";
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "make-my-resume-api",
  });

  response.status(200).json(body);
});
