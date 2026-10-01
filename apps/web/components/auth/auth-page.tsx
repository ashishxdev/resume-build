"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { FormEvent } from "react";

import { authClient } from "@/lib/auth/client";
import { prepareEmailCredentials } from "@/lib/auth/email-credentials";
import { clientEnvironment } from "@/lib/env/client";

import styles from "./auth-page.module.css";

type AuthMode = "signin" | "signup";

interface AuthPageProps {
  mode: AuthMode;
  redirectTo: string;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.1 5.1 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.85Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.93 10.93 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthBrand() {
  return (
    <Link className={styles.brand} href="/" aria-label="Make My Resume home">
      <span className={styles.brandMark} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <b>MAKE MY</b>
        <b>RESUME</b>
      </span>
    </Link>
  );
}

export function AuthPage({ mode, redirectTo }: AuthPageProps) {
  const session = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSignIn = mode === "signin";

  useEffect(() => {
    if (session.data) window.location.replace(redirectTo);
  }, [redirectTo, session.data]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${clientEnvironment.NEXT_PUBLIC_API_URL}/api/v1/auth/config`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { googleEnabled?: boolean } | null) => {
        setGoogleEnabled(Boolean(result?.googleEnabled));
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        )
          return;
        setGoogleEnabled(false);
      });

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const prepared = prepareEmailCredentials({ email, mode, name, password });

    if (!prepared.credentials) {
      setError(prepared.error);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = isSignIn
        ? await authClient.signIn.email({
            email: prepared.credentials.email,
            password: prepared.credentials.password,
            rememberMe,
          })
        : await authClient.signUp.email({
            name: prepared.credentials.name!,
            email: prepared.credentials.email,
            password: prepared.credentials.password,
          });

      if (result.error) {
        setError(
          result.error.message ??
            (isSignIn
              ? "We could not sign you in with those details."
              : "We could not create your account."),
        );
        return;
      }

      window.location.replace(redirectTo);
    } catch {
      setError("The authentication service is unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);

    if (googleEnabled === null) {
      setError(
        "Google sign-in is still being checked. Please try again shortly.",
      );
      return;
    }

    if (!googleEnabled) {
      setError("Google sign-in is not configured for this environment yet.");
      return;
    }

    setIsGoogleSigningIn(true);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      });

      if (result.error) {
        setError(result.error.message ?? "We could not start Google sign-in.");
      }
    } catch {
      setError("Google sign-in is unavailable. Please try again.");
    } finally {
      setIsGoogleSigningIn(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <AuthBrand />
        <nav aria-label="Authentication navigation">
          <Link href="/">Back to home</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.authCard} aria-labelledby="auth-title">
          <div className={styles.accent} />
          <AuthBrand />
          <div className={styles.intro}>
            <p>
              {isSignIn ? "Secure workspace access" : "Your career workspace"}
            </p>
            <h1 id="auth-title">
              {isSignIn ? "Welcome back" : "Create your account"}
            </h1>
            <span>
              {isSignIn
                ? "Continue crafting honest, tailored applications with quiet precision."
                : "Start tailoring stronger applications without compromising what is true."}
            </span>
          </div>

          <button
            className={styles.googleButton}
            disabled={
              googleEnabled === null || isGoogleSigningIn || isSubmitting
            }
            type="button"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            {googleEnabled === null
              ? "Checking Google sign-in…"
              : isGoogleSigningIn
                ? "Opening Google…"
                : "Continue with Google"}
          </button>

          <div className={styles.divider}>
            <span>or continue with email</span>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {!isSignIn && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  minLength={2}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex Mercer"
                  required
                  value={name}
                />
              </label>
            )}
            <label>
              Work or personal email
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
            <label>
              <span className={styles.passwordLabel}>
                Password{isSignIn && <span>Minimum 8 characters</span>}
              </span>
              <span className={styles.passwordField}>
                <input
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  minLength={8}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {isSignIn ? (
              <label className={styles.checkbox}>
                <input
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <i>✓</i> Remember this device
                </span>
              </label>
            ) : (
              <p className={styles.terms}>
                By creating an account, you agree to our{" "}
                <Link href="/terms">Terms</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>.
              </p>
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
                  : isSignIn
                    ? "Sign in to workspace"
                    : "Create my workspace"}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className={styles.cardFooter}>
            <span>
              {isSignIn ? "Don’t have an account?" : "Already have an account?"}{" "}
              <Link href={isSignIn ? "/signup" : "/login"}>
                {isSignIn ? "Create one" : "Sign in"}
              </Link>
            </span>
            <b>▣ Secure sessions · Zero hallucinations</b>
          </div>
        </section>

        <aside
          className={styles.proofPanel}
          aria-label="Evidence-backed resume preview"
        >
          <header>
            <span>
              <i /> Live ATS optimization
            </span>
            <b>Stripe · Staff Architect</b>
          </header>
          <article>
            <div className={styles.dossierHeader}>
              <div>
                <small>Verified candidate dossier</small>
                <h2>Alex Mercer</h2>
                <p>Principal Distributed Systems Architect</p>
              </div>
              <strong>✓ 96% Fit</strong>
            </div>
            <div className={styles.excerptLabel}>
              <span>Target experience excerpt</span>
              <span>2021 — Present</span>
            </div>
            <div className={styles.before}>
              <small>× Original generic draft</small>
              <p>
                “Responsible for maintaining backend stability and helping teams
                ship microservices faster.”
              </p>
            </div>
            <div className={styles.after}>
              <small>✓ Audited evidence-backed phrasing</small>
              <p>
                “Architected a high-throughput message pipeline handling{" "}
                <mark>140k req/sec</mark> with a verified{" "}
                <mark>99.995% SLA</mark>; condensed deploy cycles by 42%.”
              </p>
            </div>
            <footer>
              <div>
                <i>◫</i>
                <span>
                  <b>96% Structural Fit</b>
                  <small>Calibrated for Stripe ATS</small>
                </span>
              </div>
              <div>
                <i>✓</i>
                <span>
                  <b>0 Fabrications</b>
                  <small>Evidence-audited claims</small>
                </span>
              </div>
            </footer>
          </article>
          <p>
            Precision tailoring backed by verifiable evidence. No
            embellishments.
          </p>
        </aside>
      </main>

      <footer className={styles.siteFooter}>
        <span>© 2026 Make My Resume. Crafted for professional careers.</span>
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/#faq">Assistance</Link>
        </nav>
      </footer>
    </div>
  );
}
