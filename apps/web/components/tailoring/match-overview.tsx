"use client";

import type {
  JobDescription,
  ResumeMatchStatus,
} from "@make-my-resume/contracts";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "./workspace-shell";
import styles from "./tailoring.module.css";
import { authClient } from "@/lib/auth/client";
import {
  getJobDescription,
  retryJobDescriptionAnalysis,
} from "@/lib/job-description/client";

type Filter = "all" | ResumeMatchStatus;

export function MatchOverview() {
  const { jobDescriptionId } = useParams<{ jobDescriptionId: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [record, setRecord] = useState<JobDescription | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace(
        `/login?redirect=${encodeURIComponent(`/job-descriptions/${jobDescriptionId}`)}`,
      );
    }
  }, [isPending, jobDescriptionId, router, session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const next = await getJobDescription(jobDescriptionId);
        if (cancelled) return;
        setRecord(next);
        setLoading(false);
        if (["queued", "analyzing"].includes(next.status)) {
          timeout = setTimeout(() => void load(), 1_000);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "We could not load this analysis.",
          );
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [jobDescriptionId, refreshKey, session]);

  const claimMap = useMemo(
    () =>
      new Map((record?.evidenceClaims ?? []).map((claim) => [claim.id, claim])),
    [record],
  );
  const matchMap = useMemo(
    () =>
      new Map(
        record?.analysis?.matches.map((match) => [
          match.requirementId,
          match,
        ]) ?? [],
      ),
    [record],
  );
  const counts = useMemo(() => {
    const matches = record?.analysis?.matches ?? [];
    return {
      all: matches.length,
      strong: matches.filter((item) => item.status === "strong").length,
      partial: matches.filter((item) => item.status === "partial").length,
      missing: matches.filter((item) => item.status === "missing").length,
    };
  }, [record]);
  const requirements = (record?.analysis?.requirements ?? []).filter(
    (requirement) => {
      const match = matchMap.get(requirement.id);
      return filter === "all" || match?.status === filter;
    },
  );
  const score =
    counts.all > 0
      ? Math.round(((counts.strong + counts.partial * 0.5) / counts.all) * 100)
      : 0;

  async function retry() {
    if (!record) return;
    setRetrying(true);
    setError(null);
    try {
      const next = await retryJobDescriptionAnalysis(record.id);
      setRecord(next);
      if (["queued", "analyzing"].includes(next.status)) {
        setRefreshKey((value) => value + 1);
      }
      if (next.status === "failed") setError(next.failureMessage);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Retry failed.",
      );
    } finally {
      setRetrying(false);
    }
  }

  if (isPending || !session || loading) {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.spinner} />
          <p>Opening your match overview…</p>
        </main>
      </WorkspaceShell>
    );
  }
  if (record && ["queued", "analyzing"].includes(record.status)) {
    return (
      <WorkspaceShell>
        <main className={styles.analysisState} aria-live="polite">
          <Link className={styles.breadcrumb} href="/dashboard">
            ← Back to dashboard
          </Link>
          <div className={styles.analysisOrb}>
            <span />
          </div>
          <span className={styles.eyebrow}>Grounded analysis in progress</span>
          <h1>
            Reading the role,
            <br />
            <em>without reading between the lines.</em>
          </h1>
          <p>
            Your analysis is safely queued. You can leave this page and return
            without losing it.
          </p>
          <ol className={styles.analysisSteps}>
            <li data-state="done">
              <b>1</b>
              <span>
                <strong>Verified version preserved</strong>
                <small>
                  {record.evidenceClaims.length} immutable evidence claims
                </small>
              </span>
            </li>
            <li data-state="active">
              <b>2</b>
              <span>
                <strong>Mapping job requirements</strong>
                <small>Grounding every item in the pasted description</small>
              </span>
            </li>
            <li>
              <b>3</b>
              <span>
                <strong>Comparing evidence</strong>
                <small>Finding strong, partial, and missing matches</small>
              </span>
            </li>
          </ol>
        </main>
      </WorkspaceShell>
    );
  }
  if (error || !record || record.status === "failed" || !record.analysis) {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.failureIcon}>!</span>
          <h1>Analysis needs another look.</h1>
          <p>
            {error ??
              record?.failureMessage ??
              "No completed analysis is available."}
          </p>
          <div className={styles.centerActions}>
            {record?.status === "failed" && (
              <button disabled={retrying} onClick={() => void retry()}>
                {retrying ? "Analyzing…" : "Try analysis again"}
              </button>
            )}
            <Link
              href={
                record ? `/resumes/${record.resumeId}/tailor` : "/dashboard"
              }
            >
              Return to job input
            </Link>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  const title = record.role || "Target role";
  return (
    <WorkspaceShell>
      <main className={styles.main}>
        <Link className={styles.breadcrumb} href="/dashboard">
          ← Dashboard / Match overview
        </Link>
        <section className={styles.matchHero}>
          <div>
            <span className={styles.eyebrow}>Evidence match overview</span>
            <h1>
              {title}
              {record.company ? (
                <>
                  <br />
                  <em>at {record.company}</em>
                </>
              ) : null}
            </h1>
            <p>
              See exactly where your verified experience aligns—and where it
              doesn’t yet.
            </p>
          </div>
          <div
            className={styles.scoreRing}
            style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}
          >
            <span>
              <strong>{score}%</strong>
              <small>Evidence match</small>
            </span>
          </div>
        </section>

        <section className={styles.matchStats} aria-label="Match summary">
          <article data-tone="strong">
            <span>Strong matches</span>
            <strong>{counts.strong}</strong>
            <small>Direct verified evidence</small>
          </article>
          <article data-tone="partial">
            <span>Partial matches</span>
            <strong>{counts.partial}</strong>
            <small>Relevant but underrepresented</small>
          </article>
          <article data-tone="missing">
            <span>Missing</span>
            <strong>{counts.missing}</strong>
            <small>No verified evidence linked</small>
          </article>
        </section>

        <section className={styles.requirementsSection}>
          <div className={styles.requirementsHeading}>
            <div>
              <h2>Role requirements</h2>
              <p>{record.analysis.summary}</p>
            </div>
            <Link href={`/resumes/${record.resumeId}/tailor`}>
              Analyze another role
            </Link>
          </div>
          <div
            className={styles.filters}
            role="group"
            aria-label="Filter requirements"
          >
            {(["all", "strong", "partial", "missing"] as const).map(
              (option) => (
                <button
                  aria-pressed={filter === option}
                  key={option}
                  onClick={() => setFilter(option)}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}{" "}
                  <span>{counts[option]}</span>
                </button>
              ),
            )}
          </div>
          <div className={styles.requirementList}>
            {requirements.map((requirement) => {
              const match = matchMap.get(requirement.id)!;
              const evidence = match.resumeClaimIds
                .map((id) => claimMap.get(id))
                .filter((claim) => claim !== undefined);
              return (
                <article
                  className={styles.requirementCard}
                  data-status={match.status}
                  key={requirement.id}
                >
                  <div className={styles.requirementTop}>
                    <div>
                      <span>{requirement.category}</span>
                      <b>{requirement.priority}</b>
                    </div>
                    <strong>
                      {match.status === "strong"
                        ? "Strong match"
                        : match.status === "partial"
                          ? "Partial match"
                          : "Evidence missing"}
                    </strong>
                  </div>
                  <h3>{requirement.label}</h3>
                  <blockquote>“{requirement.sourceQuote}”</blockquote>
                  <p>{match.explanation}</p>
                  {evidence.length > 0 ? (
                    <div className={styles.evidence}>
                      <span>Verified evidence</span>
                      {evidence.map((claim) => (
                        <div key={claim.id}>
                          <i>✓</i>
                          <span>
                            <strong>{claim.label}</strong>
                            <small>{claim.value}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.missingEvidence}>
                      No verified resume claim supports this requirement.
                      Nothing will be invented.
                    </div>
                  )}
                </article>
              );
            })}
            {requirements.length === 0 && (
              <div className={styles.noResults}>
                No requirements in this category.
              </div>
            )}
          </div>
        </section>
        <section className={styles.nextStep}>
          <div>
            <span className={styles.eyebrow}>Next phase</span>
            <h2>Turn evidence into truthful suggestions.</h2>
            <p>
              Suggestion review and tailored draft creation are next. Your
              analysis is saved.
            </p>
          </div>
          <button
            onClick={() =>
              setNotice(
                "Tailoring suggestions are the next milestone. This evidence analysis is safely saved.",
              )
            }
          >
            Continue to suggestions →
          </button>
          {notice && <div role="status">{notice}</div>}
        </section>
      </main>
    </WorkspaceShell>
  );
}
