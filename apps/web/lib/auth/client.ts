import { createAuthClient } from "better-auth/react";

import { clientEnvironment } from "@/lib/env/client";

export const authClient = createAuthClient({
  baseURL: clientEnvironment.NEXT_PUBLIC_API_URL,
  fetchOptions: {
    credentials: "include",
  },
});
