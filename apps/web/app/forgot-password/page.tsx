import type { Metadata } from "next";

import { PasswordRecoveryPage } from "@/components/auth/password-recovery-page";

export const metadata: Metadata = {
  title: "Reset password · Make My Resume",
  description: "Request a secure Make My Resume password-reset link.",
};

export default function ForgotPasswordPage() {
  return <PasswordRecoveryPage mode="request" />;
}
