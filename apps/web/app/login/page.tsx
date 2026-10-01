import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import { getSafeRedirect } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Sign in · Make My Resume",
  description: "Sign in to your Make My Resume workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <AuthPage mode="signin" redirectTo={getSafeRedirect(redirect)} />;
}
