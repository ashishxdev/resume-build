import { fromNodeHeaders } from "better-auth/node";
import { Router } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";

export function createAuthInfoRouter(auth: Auth, googleEnabled: boolean) {
  const router = Router();

  router.get("/api/v1/auth/config", (_request, response) => {
    response.status(200).json({ googleEnabled });
  });

  router.get("/api/v1/me", async (request, response, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        response.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
        });
        return;
      }

      response.status(200).json({
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
