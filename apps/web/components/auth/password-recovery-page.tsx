"use client";

import Link from "next/link";
import { useState } from "react";

import type { FormEvent } from "react";

import { authClient } from "@/lib/auth/client";

import { AuthBrand } from "./auth-page";
import styles from "./auth-page.module.css";

type RecoveryMode = "request" | "reset";

interface PasswordRecoveryPageProps {
  errorCode?: string;
  mode: RecoveryMode;
  token?: string;
}

export function PasswordRecoveryPage({
  errorCode,
  mode,
  token,
}: PasswordRecoveryPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const isRequest = mode === "request";
  const invalidLink = !isRequest && (errorCode === "INVALID_TOKEN" || !token);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (invalidLink) return;

    if (!isRequest && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    if (!isRequest && password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = isRequest
        ? await authClient.requestPasswordReset({
            email: email.trim(),
            redirectTo: `${window.location.origin}/reset-password`,
          })
        : await authClient.resetPassword({
            newPassword: password,
            token: token!,
          });

      if (result.error) {
        setError(
          isRequest
            ? "We could not process that request. Please try again shortly."
            : "This reset link is invalid or has expired. Request a new one.",
        );
        return;
      }

      setIsComplete(true);
    } catch {
      setError("The authentication service is unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = isRequest ? "Reset your password" : "Choose a new password";

  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <AuthBrand />
        <nav aria-label="Authentication navigation">
          <Link href="/login">Back to sign in</Link>
        </nav>
      </header>

      <main className={styles.recoveryMain}>
        <section
          className={`${styles.authCard} ${styles.recoveryCard}`}
          aria-labelledby="recovery-title"
        >
          <div className={styles.accent} />
          <AuthBrand />
          <div className={styles.intro}>
            <p>Secure account recovery</p>
            <h1 id="recovery-title">{title}</h1>
            <span>
              {isRequest
                ? "Enter your account email and we’ll send a secure, single-use recovery link."
                : "Create a strong password you have not used for this account before."}
            </span>
          </div>

          {invalidLink ? (
            <div className={styles.recoveryActions}>
              <p className={styles.error} role="alert">
                This password-reset link is invalid or has expired.
              </p>
              <Link className={styles.submitButton} href="/forgot-password">
                Request a new link
              </Link>
              <Link className={styles.recoveryLink} href="/login">
                Return to sign in
              </Link>
            </div>
          ) : isComplete ? (
            <div className={styles.recoveryActions} aria-live="polite">
              <p className={styles.success}>
                {isRequest
                  ? "If an account exists for that email, a recovery link is on its way. Check your inbox and spam folder."
                  : "Your password has been updated and existing sessions have been signed out."}
              </p>
              <Link className={styles.submitButton} href="/login">
                Return to sign in
              </Link>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              {isRequest ? (
                <label>
                  Account email
                  <input
                    autoComplete="email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="alex.mercer@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </label>
              ) : (
                <>
                  <label>
                    New password
                    <input
                      autoComplete="new-password"
                      minLength={8}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      type="password"
                      value={password}
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      autoComplete="new-password"
                      minLength={8}
                      name="confirmation"
                      onChange={(event) => setConfirmation(event.target.value)}
                      placeholder="Repeat your new password"
                      required
                      type="password"
                      value={confirmation}
                    />
                  </label>
                </>
              )}

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <button
                className={styles.submitButton}
                disabled={isSubmitting}
                type="submit"
              >
                <span>
                  {isSubmitting
                    ? "Please wait…"
                    : isRequest
                      ? "Send recovery link"
                      : "Update password"}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
        </section>
      </main>

      <footer className={styles.siteFooter}>
        <span>© 2026 Make My Resume. Secure account recovery.</span>
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
