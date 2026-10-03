"use client";

import type { ResumeSummary } from "@make-my-resume/contracts";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "./workspace-shell";
import styles from "./tailoring.module.css";
import { authClient } from "@/lib/auth/client";
import {
  createJobDescription,
  retryJobDescriptionAnalysis,
} from "@/lib/job-description/client";
import { listResumes } from "@/lib/resume/import-client";
import { getResumeVerification } from "@/lib/resume/verification-client";

const minimumCharacters = 100;

export function JobDescriptionWorkflow() {
  const params = useParams<{ resumeId: string }>();
  const resumeId = params.resumeId;
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [resume, setResume] = useState<ResumeSummary | null>(null);
  const [claimCount, setClaimCount] = useState(0);
  const [verificationReady, setVerificationReady] = useState(false);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedJobDescriptionId, setFailedJobDescriptionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isPending && !session)
      router.replace(
        `/login?redirect=${encodeURIComponent(`/resumes/${resumeId}/tailor`)}`,
      );
  }, [isPending, resumeId, router, session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([listResumes(), getResumeVerification(resumeId)])
      .then(([resumes, verification]) => {
        if (cancelled) return;
        setResume(resumes.find((item) => item.id === resumeId) ?? null);
        if (verification.status !== "verified") {
          setError(
            "This resume must be fully verified before you can tailor it.",
          );
        } else {
          setVerificationReady(true);
        }
        setClaimCount(
          verification.claims.filter((claim) => claim.status !== "rejected")
            .length,
        );
      })
      .catch(
        () => !cancelled && setError("We could not load this verified resume."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [resumeId, session]);

  const canSubmit =
    rawText.trim().length >= minimumCharacters &&
    !analyzing &&
    !loading &&
    verificationReady;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setAnalyzing(true);
    try {
      const result = failedJobDescriptionId
        ? await retryJobDescriptionAnalysis(failedJobDescriptionId)
        : await createJobDescription({
            resumeId,
            role: role.trim() || undefined,
            company: company.trim() || undefined,
            rawText,
          });
      if (["queued", "analyzing", "completed"].includes(result.status)) {
        router.push(`/job-descriptions/${result.id}`);
        return;
      }
      setFailedJobDescriptionId(result.id);
      setError(result.failureMessage ?? "The analysis could not be completed.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The analysis could not be completed.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  if (isPending || !session || loading) {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.spinner} />
          <p>Loading your verified baseline…</p>
        </main>
      </WorkspaceShell>
    );
  }

  if (analyzing) {
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
            We’re extracting requirements and comparing them only with claims
            you already verified.
          </p>
          <ol className={styles.analysisSteps}>
            <li data-state="done">
              <b>1</b>
              <span>
                <strong>Verified resume loaded</strong>
                <small>{claimCount} approved claims ready</small>
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
          <div className={styles.analysisNote}>
            Your job description and resume content are treated as data—not
            instructions—and are not retained by the AI provider.
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <main className={styles.main}>
        <Link className={styles.breadcrumb} href="/dashboard">
          ← Dashboard / Your resumes
        </Link>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>New tailored application</span>
          <h1>
            What role are you
            <br />
            <em>aiming for?</em>
          </h1>
          <p>
            Paste the original job description. We’ll separate what it asks for
            from what your verified resume can prove.
          </p>
        </div>
        <div className={styles.inputGrid}>
          <form className={styles.formCard} onSubmit={submit}>
            <div className={styles.twoFields}>
              <label>
                Role title <span>Optional</span>
                <input
                  maxLength={160}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setFailedJobDescriptionId(null);
                  }}
                  placeholder="e.g. Senior Product Designer"
                  value={role}
                />
              </label>
              <label>
                Company <span>Optional</span>
                <input
                  maxLength={160}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    setFailedJobDescriptionId(null);
                  }}
                  placeholder="e.g. Acme"
                  value={company}
                />
              </label>
            </div>
            <label className={styles.descriptionLabel}>
              Job description <b>Required</b>
              <textarea
                maxLength={50000}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setFailedJobDescriptionId(null);
                }}
                placeholder="Paste the complete job description here…"
                value={rawText}
              />
              <small>
                <span>{rawText.length.toLocaleString()} / 50,000</span>
                <span>Minimum {minimumCharacters} characters</span>
              </small>
            </label>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            <div className={styles.formFooter}>
              <p>
                Missing requirements stay missing. We never invent experience to
                improve a score.
              </p>
              <button disabled={!canSubmit} type="submit">
                {failedJobDescriptionId
                  ? "Try analysis again"
                  : "Analyze match"}{" "}
                <span>→</span>
              </button>
            </div>
          </form>
          <aside className={styles.sideColumn}>
            <article className={styles.resumeContext}>
              <span className={styles.eyebrow}>Verified resume</span>
              <div>
                <i aria-hidden="true">✓</i>
                <span>
                  <strong>{resume?.name ?? "Your resume"}</strong>
                  <small>
                    {resume?.originalFileName ?? "Verified baseline"}
                  </small>
                </span>
              </div>
              <dl>
                <div>
                  <dt>Evidence claims</dt>
                  <dd>{claimCount}</dd>
                </div>
                <div>
                  <dt>Baseline status</dt>
                  <dd>Verified</dd>
                </div>
              </dl>
              <Link href={`/resumes/${resumeId}/verify`}>
                Review verified evidence →
              </Link>
            </article>
            <article className={styles.trustNote}>
              <span>✦</span>
              <h2>Truth before keywords.</h2>
              <p>
                Every match must trace back to this role and your verified
                history.
              </p>
            </article>
          </aside>
        </div>
      </main>
    </WorkspaceShell>
  );
}
