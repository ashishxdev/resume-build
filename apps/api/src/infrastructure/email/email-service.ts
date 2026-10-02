import { Resend } from "resend";

import type { Environment } from "../../config/environment.js";

export interface PasswordResetEmail {
  name: string;
  resetUrl: string;
  to: string;
}

export interface TransactionalEmailService {
  sendPasswordReset(message: PasswordResetEmail): Promise<void>;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}

export function renderPasswordResetEmail({
  name,
  resetUrl,
}: Pick<PasswordResetEmail, "name" | "resetUrl">) {
  const displayName = name || "there";
  const safeName = escapeHtml(displayName);
  const safeResetUrl = escapeHtml(resetUrl);

  return {
    subject: "Reset your Make My Resume password",
    text: [
      `Hi ${displayName},`,
      "",
      "We received a request to reset your Make My Resume password.",
      `Reset your password: ${resetUrl}`,
      "",
      "This link expires in 60 minutes and can only be used once.",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f2f7;color:#1b1b1e;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:40px 20px">
      <div style="border-top:4px solid #25173d;border-radius:8px;background:#ffffff;padding:36px;box-shadow:0 12px 30px rgba(37,23,61,.08)">
        <p style="margin:0 0 20px;color:#3b2d54;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Make My Resume</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:32px;font-weight:500;color:#25173d">Reset your password</h1>
        <p style="margin:0 0 14px;line-height:1.7">Hi ${safeName},</p>
        <p style="margin:0 0 24px;line-height:1.7;color:#514d54">We received a request to reset your password. Use the secure link below within 60 minutes.</p>
        <p style="margin:0 0 28px"><a href="${safeResetUrl}" style="display:inline-block;border-radius:5px;background:#25173d;color:#ffffff;padding:14px 20px;font-weight:700;text-decoration:none">Choose a new password</a></p>
        <p style="margin:0;color:#6d6870;font-size:13px;line-height:1.7">This link can only be used once. If you did not request it, no action is required.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

class UnconfiguredEmailService implements TransactionalEmailService {
  async sendPasswordReset() {
    throw new Error("Transactional email is not configured");
  }
}

export function createTransactionalEmailService(
  environment: Pick<
    Environment,
    "EMAIL_FROM" | "EMAIL_REPLY_TO" | "RESEND_API_KEY"
  >,
): TransactionalEmailService {
  if (!environment.RESEND_API_KEY || !environment.EMAIL_FROM) {
    return new UnconfiguredEmailService();
  }

  const resend = new Resend(environment.RESEND_API_KEY);

  return {
    async sendPasswordReset(message) {
      const content = renderPasswordResetEmail(message);
      const { error } = await resend.emails.send({
        from: environment.EMAIL_FROM!,
        replyTo: environment.EMAIL_REPLY_TO,
        to: message.to,
        ...content,
      });

      if (error) {
        throw new Error("Resend rejected the transactional email request");
      }
    },
  };
}
