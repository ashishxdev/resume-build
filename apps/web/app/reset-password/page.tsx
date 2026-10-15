import type { Metadata } from "next";

import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Choose a new password · Make My Resume",
  description: "Set a new password for your Make My Resume account.",
};

export default function ResetPasswordPage() {
  // Password recovery is paused; do not render forms for existing reset links.
  redirect("/login");
}
