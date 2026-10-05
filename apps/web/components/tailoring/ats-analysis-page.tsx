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
  completeAtsImprovements,
  decideAtsImprovement,
  getTailoringSession,
  retryAtsAnalysis,
  retryAtsImprovements,
  setAtsImprovedVersionActive,
  startAtsAnalysis,
  startAtsImprovements,
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
  busy,
  onStart,
  onToggleVersion,
}: {
  session: TailoringSession;
  snapshot: AtsAnalysisSnapshot;
  busy: boolean;
  onStart: () => void;
  onToggleVersion: (active: boolean) => void;
}) {
  const baselineSnapshot = session.atsSnapshot ?? snapshot;
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
  const eligible = grouped.can_improve.some(
    (finding) => finding.resumeClaimIds.length > 0,
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
      {session.atsImprovementStatus === "not_started" && eligible && (
        <section className={styles.atsImprovementCta}>
          <div>
            <span className={styles.eyebrow}>Evidence-backed next step</span>
            <h2>Improve the findings we can safely support.</h2>
            <p>
              We’ll rewrite only verified claims connected to partial matches.
              Missing experience stays informational and is never invented.
            </p>
          </div>
          <button disabled={busy} onClick={onStart}>
            {busy ? "Starting…" : "Generate improvements"}
          </button>
        </section>
      )}
      {session.atsImprovementStatus === "completed" &&
        session.atsImprovedSnapshot && (
          <section className={styles.atsVersionCompare}>
            <div>
              <span className={styles.eyebrow}>Version comparison</span>
              <h2>
                {baselineSnapshot.overallScore} →{" "}
                {session.atsImprovedSnapshot.overallScore}
              </h2>
              <p>
                The original tailored version remains saved. Downloads and the
                resume preview currently use the{" "}
                {session.atsImprovementActive ? "improved" : "original"}{" "}
                version.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => onToggleVersion(!session.atsImprovementActive)}
            >
              {session.atsImprovementActive
                ? "Use original version"
                : "Use improved version"}
            </button>
          </section>
        )}
    </main>
  );
}

function ImprovementReview({
  session,
  busyId,
  onDecision,
  onComplete,
}: {
  session: TailoringSession;
  busyId: string | null;
  onDecision: (
    suggestionId: string,
    status: "accepted" | "rejected",
    editedText?: string,
  ) => void;
  onComplete: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const pending = session.atsImprovementSuggestions.filter(
    (suggestion) => suggestion.status === "pending",
  ).length;
  const accepted = session.atsImprovementSuggestions.filter(
    (suggestion) => suggestion.status === "accepted",
  ).length;
  return (
    <main className={styles.atsPage}>
      <Link className={styles.breadcrumb} href={`/tailoring/${session.id}/ats`}>
        ← ATS analysis
      </Link>
      <section className={styles.reviewHero}>
        <div>
          <span className={styles.eyebrow}>ATS improvement review</span>
          <h1>Keep every change true to your evidence.</h1>
          <p>
            Accept, reject, or edit each proposal. Missing requirements are
            excluded because your resume does not verify them.
          </p>
        </div>
        <div className={styles.reviewScore}>
          <span>{session.atsImprovementSuggestions.length}</span>
          <small>safe proposals</small>
        </div>
      </section>
      <div className={styles.suggestionList}>
        {session.atsImprovementSuggestions.map((suggestion) => {
          const draft =
            drafts[suggestion.id] ??
            suggestion.editedText ??
            suggestion.suggestedText;
          return (
            <article
              className={`${styles.panel} ${styles.suggestionCard}`}
              data-status={suggestion.status}
              key={suggestion.id}
            >
              <header>
                <span>{suggestion.section}</span>
                <strong>{suggestion.status}</strong>
              </header>
              <div className={styles.comparison}>
                <div>
                  <span>Current wording</span>
                  <p>{suggestion.originalText}</p>
                </div>
                <div>
                  <span>Proposed wording</span>
                  <textarea
                    aria-label={`Edit ${suggestion.section} improvement`}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [suggestion.id]: event.target.value,
                      }))
                    }
                    value={draft}
                  />
                </div>
              </div>
              <div className={styles.suggestionReason}>
                <strong>Why this helps</strong>
                <p>{suggestion.reason}</p>
                <small>
                  Bound to {suggestion.requirementIds.length} analyzed
                  requirement
                  {suggestion.requirementIds.length === 1 ? "" : "s"}.
                </small>
              </div>
              <footer>
                <button
                  disabled={busyId !== null}
                  onClick={() =>
                    onDecision(suggestion.id, "accepted", draft.trim())
                  }
                >
                  {busyId === suggestion.id ? "Saving…" : "Accept wording"}
                </button>
                <button
                  disabled={busyId !== null}
                  onClick={() => onDecision(suggestion.id, "rejected")}
                >
                  Reject
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      <section className={`${styles.panel} ${styles.reviewDock}`}>
        <div>
          <strong>
            {pending ? `${pending} decisions remaining` : "Review complete"}
          </strong>
          <span>{accepted} improvements accepted</span>
        </div>
        <button
          disabled={pending > 0 || accepted === 0 || busyId !== null}
          onClick={onComplete}
        >
          Create revised version
        </button>
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
  const [busyId, setBusyId] = useState<string | null>(null);

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
        if (
          ["queued", "analyzing"].includes(next.atsStatus) ||
          ["queued", "generating"].includes(next.atsImprovementStatus)
        )
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

  async function startImprovements() {
    if (!session) return;
    setBusyId("start");
    setError(null);
    try {
      setSession(await startAtsImprovements(session.id));
      setRetrying((value) => !value);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Improvements could not be started.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function retryImprovements() {
    if (!session) return;
    setBusyId("retry-improvements");
    setError(null);
    try {
      setSession(await retryAtsImprovements(session.id));
      setRetrying((value) => !value);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Improvements could not be retried.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function decideImprovement(
    suggestionId: string,
    status: "accepted" | "rejected",
    editedText?: string,
  ) {
    if (!session) return;
    setBusyId(suggestionId);
    setError(null);
    try {
      setSession(
        await decideAtsImprovement(
          session,
          suggestionId,
          status,
          status === "accepted" ? editedText : null,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The improvement decision could not be saved.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function completeImprovements() {
    if (!session) return;
    setBusyId("complete");
    setError(null);
    try {
      setSession(await completeAtsImprovements(session));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The revised version could not be created.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleImprovedVersion(active: boolean) {
    if (!session) return;
    setBusyId("toggle");
    setError(null);
    try {
      setSession(await setAtsImprovedVersionActive(session.id, active));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The active resume version could not be changed.",
      );
    } finally {
      setBusyId(null);
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
  if (["queued", "generating"].includes(session.atsImprovementStatus))
    return (
      <WorkspaceShell>
        <main className={styles.atsLoading} aria-live="polite">
          <span className={styles.spinner} />
          <span className={styles.eyebrow}>Evidence-backed improvements</span>
          <h1>Preparing safe wording options…</h1>
          <p>
            We’re using only verified claims connected to partial ATS matches.
            Missing requirements are excluded.
          </p>
          {error && <div className={styles.pollNotice}>{error}</div>}
        </main>
      </WorkspaceShell>
    );
  if (session.atsImprovementStatus === "failed")
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.failureIcon}>!</span>
          <h1>Improvement generation needs another try.</h1>
          <p>{session.atsImprovementFailureMessage}</p>
          {error && <p className={styles.error}>{error}</p>}
          <button
            disabled={busyId !== null}
            onClick={() => void retryImprovements()}
          >
            {busyId ? "Retrying…" : "Try again"}
          </button>
        </main>
      </WorkspaceShell>
    );
  if (session.atsImprovementStatus === "review")
    return (
      <WorkspaceShell>
        {error && <p className={styles.error}>{error}</p>}
        <ImprovementReview
          busyId={busyId}
          onComplete={() => void completeImprovements()}
          onDecision={(...arguments_) => void decideImprovement(...arguments_)}
          session={session}
        />
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
      {error && <p className={styles.error}>{error}</p>}
      <Results
        busy={busyId !== null}
        onStart={() => void startImprovements()}
        onToggleVersion={(active) => void toggleImprovedVersion(active)}
        session={session}
        snapshot={
          session.atsImprovementActive && session.atsImprovedSnapshot
            ? session.atsImprovedSnapshot
            : session.atsSnapshot
        }
      />
    </WorkspaceShell>
  );
}
