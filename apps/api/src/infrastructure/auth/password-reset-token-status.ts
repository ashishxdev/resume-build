import { createAuthEndpoint } from "better-auth/api";
import * as z from "zod";

const tokenStatusBody = z.object({
  token: z.string().min(1),
});

export function passwordResetTokenStatus() {
  return {
    id: "password-reset-token-status",
    endpoints: {
      passwordResetTokenStatus: createAuthEndpoint(
        "/password-reset-token-status",
        {
          method: "POST",
          body: tokenStatusBody,
        },
        async (context) => {
          const verification =
            await context.context.internalAdapter.findVerificationValue(
              `reset-password:${context.body.token}`,
            );

          return context.json({
            valid: Boolean(
              verification && verification.expiresAt.getTime() > Date.now(),
            ),
          });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) =>
          path.startsWith("/password-reset-token-status"),
        window: 60,
        max: 10,
      },
    ],
  };
}
