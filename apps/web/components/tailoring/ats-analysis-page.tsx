"use client";

import type {
  AtsAnalysisSnapshot,
  TailoringSession,
} from "@make-my-resume/contracts";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "./workspace-shell";
import styles from "./tailoring.module.css";
import { authClient } from "@/lib/auth/client";
import {
  getTailoringSession,
  retryAtsAnalysis,
  startAtsAnalysis,
} from "@/lib/tailoring/client";

const findingLabels = {
  strength: "Strong evidence",
  can_improve: "Can improve",
  missing: "Actually missing",
} as const;

export function atsAlignmentHeadline(score: number) {
  if (score >= 80) return "strong alignment";
  if (score >= 60) return "moderate alignment";
  return "weak alignment";
}

function Results({
  session,
  snapshot,
}: {
  session: TailoringSession;
  snapshot: AtsAnalysisSnapshot;
}) {
  const grouped = useMemo(
    () => ({
      strength: snapshot.findings.filter((item) => item.type === "strength"),
      can_improve: snapshot.findings.filter(
        (item) => item.type === "can_improve",
      ),
      missing: snapshot.findings.filter((item) => item.type === "missing"),
    }),
    [snapshot],
  );
  return (
    <main className={styles.atsPage}>
      <Link className={styles.breadcrumb} href={`/tailoring/${session.id}`}>
        ← Tailored version
      </Link>
      <section className={styles.atsHero}>
        <div>
          <span className={styles.eyebrow}>
            ATS compatibility · transparent methodology
          </span>
          <h1>
            Your resume shows{" "}
            <em>{atsAlignmentHeadline(snapshot.overallScore)}.</em>
          </h1>
          <p>
            This is an internal compatibility indicator—not an employer’s
            proprietary ATS score.
          </p>
        </div>
        <div
          className={styles.atsScore}
          aria-label={`Compatibility score ${snapshot.overallScore} out of 100`}
        >
          <strong>{snapshot.overallScore}</strong>
          <span>/100</span>
          <small>Compatibility</small>
        </div>
      </section>
      <section
        className={styles.atsCategories}
        aria-label="Compatibility categories"
      >
        {snapshot.categories.map((item) => (
          <article key={item.category}>
            <header>
              <strong>{item.label}</strong>
              <b>{item.score}</b>
            </header>
            <div>
              <span style={{ width: `${item.score}%` }} />
            </div>
            <p>{item.explanation}</p>
          </article>
        ))}
      </section>
      <div className={styles.atsFindingsGrid}>
        {(["can_improve", "missing", "strength"] as const).map((type) => (
          <section
            className={styles.atsFindingGroup}
            data-type={type}
            key={type}
          >
            <header>
              <h2>{findingLabels[type]}</h2>
              <span>{grouped[type].length}</span>
            </header>
            {grouped[type].length === 0 ? (
              <p className={styles.atsEmpty}>No findings in this category.</p>
            ) : (
              grouped[type].map((finding) => (
                <article key={finding.id}>
                  <h3>{finding.title}</h3>
                  <p>{finding.explanation}</p>
                  <small>
                    {finding.resumeClaimIds.length
                      ? `${finding.resumeClaimIds.length} verified evidence source${finding.resumeClaimIds.length === 1 ? "" : "s"}`
                      : "No verified evidence—nothing will be invented"}
                  </small>
                </article>
              ))
            )}
          </section>
        ))}
      </div>
      <section className={styles.atsMethod}>
        <div>
          <span className={styles.eyebrow}>What this score means</span>
          <h2>Useful guidance, without false precision.</h2>
        </div>
        <p>
          The analysis combines requirement coverage, verified evidence
          alignment, section completeness, readability, and structured-format
          checks. It never claims access to an employer’s ranking system.
        </p>
      </section>
    </main>
  );
}

export function AtsAnalysisPage() {
  const { tailoringSessionId } = useParams<{ tailoringSessionId: string }>();
  const router = useRouter();
  const { data: authSession, isPending } = authClient.useSession();
  const [session, setSession] = useState<TailoringSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!isPending && !authSession)
      router.replace(
        `/login?redirect=${encodeURIComponent(`/tailoring/${tailoringSessionId}/ats`)}`,
      );
  }, [authSession, isPending, router, tailoringSessionId]);

  useEffect(() => {
    if (!authSession) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        let next = await getTailoringSession(tailoringSessionId);
        if (next.status !== "completed")
          throw new Error(
            "Complete the tailored version before running ATS analysis.",
          );
        if (next.atsStatus === "not_started")
          next = await startAtsAnalysis(next.id);
        if (cancelled) return;
        setSession(next);
        setError(null);
        if (["queued", "analyzing"].includes(next.atsStatus))
          timeout = setTimeout(() => void load(), 1_000);
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "We could not load ATS analysis.",
        );
        timeout = setTimeout(() => void load(), 3_000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [authSession, retrying, tailoringSessionId]);

  async function retry() {
    if (!session) return;
    setRetrying(true);
    setError(null);
    try {
      setSession(await retryAtsAnalysis(session.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Retry failed.",
      );
    } finally {
      setRetrying(false);
    }
  }

  if (
    isPending ||
    !authSession ||
    !session ||
    ["not_started", "queued", "analyzing"].includes(session.atsStatus)
  )
    return (
      <WorkspaceShell>
        <main className={styles.atsLoading} aria-live="polite">
          <span className={styles.spinner} />
          <span className={styles.eyebrow}>ATS compatibility</span>
          <h1>Checking alignment and readability…</h1>
          <p>
            We’re evaluating the saved tailored version. You can safely leave
            and return.
          </p>
          {error && (
            <div className={styles.pollNotice}>{error} We’ll keep trying.</div>
          )}
        </main>
      </WorkspaceShell>
    );
  if (session.atsStatus === "failed")
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.failureIcon}>!</span>
          <h1>ATS analysis needs another try.</h1>
          <p>{session.atsFailureMessage}</p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.centerActions}>
            <button disabled={retrying} onClick={() => void retry()}>
              {retrying ? "Retrying…" : "Try again"}
            </button>
            <Link href={`/tailoring/${session.id}`}>
              Return to tailored version
            </Link>
          </div>
        </main>
      </WorkspaceShell>
    );
  if (!session.atsSnapshot)
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <h1>Analysis unavailable.</h1>
          <Link href={`/tailoring/${session.id}`}>
            Return to tailored version
          </Link>
        </main>
      </WorkspaceShell>
    );
  return (
    <WorkspaceShell>
      <Results session={session} snapshot={session.atsSnapshot} />
    </WorkspaceShell>
  );
}
