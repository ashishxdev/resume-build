"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { FormEvent } from "react";

import { authClient } from "@/lib/auth/client";
import { prepareEmailCredentials } from "@/lib/auth/email-credentials";

import styles from "./auth-page.module.css";

type AuthMode = "signin" | "signup";

interface AuthPageProps {
  mode: AuthMode;
  redirectTo: string;
}

export function AuthBrand() {
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
  const [error, setError] = useState<string | null>(null);

  const isSignIn = mode === "signin";

  useEffect(() => {
    if (session.data) window.location.replace(redirectTo);
  }, [redirectTo, session.data]);

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
                Password
                {/* Password recovery is paused until a production sender is verified. */}
                {!isSignIn && <span>Minimum 8 characters</span>}
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
