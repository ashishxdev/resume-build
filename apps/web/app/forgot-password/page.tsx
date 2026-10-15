import type { Metadata } from "next";

import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Reset password · Make My Resume",
  description: "Request a secure Make My Resume password-reset link.",
};

export default function ForgotPasswordPage() {
  // Restore the recovery component once production email delivery is enabled.
  redirect("/login");
}
