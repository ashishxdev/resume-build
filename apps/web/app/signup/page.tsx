import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import { getSafeRedirect } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Create an account · Make My Resume",
  description: "Create your private Make My Resume workspace.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <AuthPage mode="signup" redirectTo={getSafeRedirect(redirect)} />;
}
