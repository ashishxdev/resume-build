import type { Metadata } from "next";

import { PasswordRecoveryPage } from "@/components/auth/password-recovery-page";

export const metadata: Metadata = {
  title: "Choose a new password · Make My Resume",
  description: "Set a new password for your Make My Resume account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const { error, token } = await searchParams;

  return <PasswordRecoveryPage errorCode={error} mode="reset" token={token} />;
}
