"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";

import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !data) {
      router.replace("/login?redirect=%2Fdashboard");
    }
  }, [data, isPending, router]);

  async function signOut() {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setSignOutError(
          result.error.message ??
            "We could not end your session. Please try again.",
        );
        return;
      }

      window.location.replace("/login");
    } catch {
      setSignOutError(
        "The authentication service is unavailable. Your session is still active.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isPending || !data) {
    return (
      <main className={styles.loading} aria-live="polite">
        <span />
        <p>Opening your secure workspace…</p>
      </main>
    );
  }

  const firstName = data.user.name?.split(" ")[0] || "there";

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          <span>≡</span>
          <b>
            MAKE MY
            <br />
            RESUME
          </b>
        </Link>
        <nav>
          <Link className={styles.active} href="/dashboard">
            Overview
          </Link>
          <span>Resumes</span>
          <span>Tailoring</span>
          <span>Versions</span>
        </nav>
        <div className={styles.user}>
          <span>{data.user.name?.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{data.user.name}</b>
            <small>{data.user.email}</small>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header>
          <div>
            <p>Private workspace</p>
            <h1>Welcome back, {firstName}.</h1>
            <span>Your evidence-backed resume workspace is ready.</span>
          </div>
          <button disabled={isSigningOut} onClick={signOut} type="button">
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </header>
        {signOutError && (
          <p className={styles.signOutError} role="alert">
            {signOutError}
          </p>
        )}
        <section className={styles.stats}>
          <article>
            <span>Resumes</span>
            <b>0</b>
            <small>Your verified career profiles</small>
          </article>
          <article>
            <span>Tailored versions</span>
            <b>0</b>
            <small>Role-specific applications</small>
          </article>
          <article>
            <span>Current plan</span>
            <b>Free</b>
            <small>2 tailored resumes included</small>
          </article>
        </section>
        <section className={styles.empty}>
          <span>01</span>
          <div>
            <p>Resume foundation</p>
            <h2>Bring your experience into the workspace.</h2>
            <span>
              Resume import and verification will be the next major product
              milestone.
            </span>
          </div>
          <button type="button" disabled>
            Import resume · Coming next
          </button>
        </section>
      </main>
    </div>
  );
}
