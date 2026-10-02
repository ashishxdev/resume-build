import { describe, expect, it } from "vitest";

import { renderPasswordResetEmail } from "./email-service.js";

describe("renderPasswordResetEmail", () => {
  it("renders text and HTML reset instructions", () => {
    const message = renderPasswordResetEmail({
      name: "Alex Mercer",
      resetUrl: "https://example.com/reset?token=secure-token",
    });

    expect(message.subject).toContain("Reset");
    expect(message.text).toContain(
      "https://example.com/reset?token=secure-token",
    );
    expect(message.html).toContain("Choose a new password");
  });

  it("escapes user-controlled HTML content", () => {
    const message = renderPasswordResetEmail({
      name: '<script>alert("x")</script>',
      resetUrl: 'https://example.com/reset?next="unsafe"&token=one',
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("&quot;unsafe&quot;&amp;token=one");
  });
});
