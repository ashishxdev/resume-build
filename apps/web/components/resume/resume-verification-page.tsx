"use client";

import type {
  ResumeClaim,
  ResumeClaimCategory,
  ResumeVerification,
} from "@make-my-resume/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import {
  getResumeVerification,
  retryResumeExtraction,
  saveResumeVerification,
} from "@/lib/resume/verification-client";

import styles from "./resume-verification-page.module.css";

const categoryLabels: Record<ResumeClaimCategory, string> = {
  personal_info: "Personal information",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Achievements",
  custom: "Other details",
};

const categories = Object.keys(categoryLabels) as ResumeClaimCategory[];

export function ResumeVerificationPage({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const authenticatedUserId = session?.user.id;
  const [verification, setVerification] = useState<ResumeVerification | null>(
    null,
  );
  const [claims, setClaims] = useState<ResumeClaim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pollGeneration, setPollGeneration] = useState(0);

  const load = useCallback(async () => {
    try {
      const next = await getResumeVerification(resumeId);
      setVerification(next);
      setClaims(next.claims);
      setHasUnsavedChanges(false);
      setSaveNotice(null);
      setError(null);
      return next;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Verification could not be loaded.",
      );
      return null;
    }
  }, [resumeId]);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace(
        `/login?redirect=${encodeURIComponent(`/resumes/${resumeId}/verify`)}`,
      );
    }
  }, [isPending, resumeId, router, session]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const next = await load();
      if (!disposed && next && ["queued", "processing"].includes(next.status)) {
        timeout = setTimeout(poll, 1_500);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [authenticatedUserId, load, pollGeneration]);

  const reviewedCount = claims.filter(
    (claim) => claim.status !== "unreviewed",
  ).length;
  const groupedClaims = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          claims: claims.filter((claim) => claim.category === category),
        }))
        .filter((group) => group.claims.length > 0),
    [claims],
  );

  function updateClaim(id: string, patch: Partial<ResumeClaim>) {
    setHasUnsavedChanges(true);
    setSaveNotice(null);
    setClaims((current) =>
      current.map((claim) =>
        claim.id === id ? { ...claim, ...patch } : claim,
      ),
    );
  }

  function moveClaim(id: string, direction: -1 | 1) {
    setHasUnsavedChanges(true);
    setSaveNotice(null);
    setClaims((current) => {
      const index = current.findIndex((claim) => claim.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length)
        return current;
      const next = [...current];
      const currentClaim = next[index];
      const destinationClaim = next[destination];
      if (!currentClaim || !destinationClaim) return current;
      next[index] = destinationClaim;
      next[destination] = currentClaim;
      return next.map((claim, order) => ({ ...claim, order }));
    });
  }

  function addClaim() {
    setHasUnsavedChanges(true);
    setSaveNotice(null);
    setClaims((current) => [
      ...current,
      {
        id: `new-${crypto.randomUUID()}`,
        category: "custom",
        label: "Additional detail",
        value: "",
        sourceText: null,
        pageNumber: null,
        status: "confirmed",
        userAdded: true,
        order: current.length,
      },
    ]);
  }

  async function save() {
    if (claims.some((claim) => !claim.value.trim() || !claim.label.trim())) {
      setError("Every kept detail needs a label and value.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await saveResumeVerification(resumeId, claims);
      setVerification(updated);
      setClaims(updated.claims);
      setHasUnsavedChanges(false);
      setSaveNotice(
        updated.status === "verified"
          ? "Verified baseline saved. Future tailoring will use these details."
          : "Your review progress has been saved.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your review could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function retry() {
    setError(null);
    setIsRetrying(true);
    try {
      const queued = await retryResumeExtraction(resumeId);
      setVerification(queued);
      setPollGeneration((generation) => generation + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Extraction could not be retried.",
      );
    } finally {
      setIsRetrying(false);
    }
  }

  if (isPending || !session || !verification) {
    return (
      <main className={styles.statePage}>
        <div className={styles.spinner} />
        <h1>
          {error
            ? "We couldn’t open this review"
            : "Preparing your evidence review…"}
        </h1>
        {error && <p role="alert">{error}</p>}
        <Link href="/dashboard">Return to dashboard</Link>
      </main>
    );
  }

  if (["queued", "processing"].includes(verification.status)) {
    return (
      <main className={styles.statePage}>
        <div className={styles.spinner} />
        <span className={styles.eyebrow}>Document extraction</span>
        <h1>We’re reading your resume.</h1>
        <p>
          Your original stays untouched while we prepare details for your
          approval.
        </p>
        <div className={styles.progress}>
          <i style={{ width: `${verification.progress}%` }} />
        </div>
        <Link href="/dashboard">Continue in the background</Link>
      </main>
    );
  }

  if (verification.status === "failed") {
    const normalizedFailureMessage =
      verification.failureMessage?.toLocaleLowerCase("en") ?? "";
    const hasNoSelectableText =
      normalizedFailureMessage.includes("scanned or flattened") ||
      normalizedFailureMessage.includes("no readable text was found");
    return (
      <main className={styles.statePage}>
        <span className={styles.eyebrow}>Extraction needs attention</span>
        <h1>
          {hasNoSelectableText
            ? "This document has no selectable text."
            : "We couldn’t read this document."}
        </h1>
        <p role={hasNoSelectableText ? "alert" : undefined}>
          {verification.failureMessage ??
            "Try the original again or upload a text-based PDF or DOCX."}
        </p>
        {hasNoSelectableText && (
          <p>
            Use the original DOCX or export the source document directly to PDF.
            You should be able to highlight and copy its text before uploading
            it.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className={styles.stateActions}>
          {!hasNoSelectableText && (
            <button
              disabled={isRetrying}
              onClick={() => void retry()}
              type="button"
            >
              {isRetrying ? "Retrying…" : "Retry extraction"}
            </button>
          )}
          <Link href="/dashboard">
            {hasNoSelectableText
              ? "Upload a different file"
              : "Return to dashboard"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard" aria-label="Dashboard">
          M
        </Link>
        <div>
          <span>
            {verification.status === "verified"
              ? "Verified baseline"
              : "Evidence review"}
          </span>
          <b>
            {reviewedCount} / {claims.length} reviewed
          </b>
        </div>
        <Link href="/dashboard">Exit review</Link>
      </header>
      <main className={styles.main}>
        <section className={styles.intro}>
          <span className={styles.eyebrow}>Zero-hallucination baseline</span>
          <h1>Make every detail true to you.</h1>
          <p>
            Review the résumé content below. Keep each detail as written, edit
            it, remove it, or add anything that is missing. Saved changes will
            be used for future tailored resumes.
          </p>
          <div className={styles.reviewTrack}>
            <i
              style={{
                width: claims.length
                  ? `${(reviewedCount / claims.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </section>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {saveNotice && (
          <p className={styles.success} role="status">
            <span aria-hidden="true">✓</span> {saveNotice}
          </p>
        )}

        {verification.status === "verified" && !hasUnsavedChanges && (
          <section
            className={styles.nextStep}
            aria-labelledby="next-step-title"
          >
            <div>
              <span className={styles.eyebrow}>Baseline ready</span>
              <h2 id="next-step-title">Tailor it for your next role.</h2>
              <p>
                Add a job description to compare requirements and create an
                evidence-backed tailored version.
              </p>
            </div>
            <div className={styles.nextStepActions}>
              <Link href={`/resumes/${resumeId}/tailor`}>
                Tailor this résumé <span aria-hidden="true">→</span>
              </Link>
              <Link href="/dashboard">Return to dashboard</Link>
            </div>
          </section>
        )}

        <div className={styles.groups}>
          {groupedClaims.map((group) => (
            <section className={styles.group} key={group.category}>
              <div className={styles.groupHeading}>
                <h2>{categoryLabels[group.category]}</h2>
                <span>{group.claims.length} details</span>
              </div>
              {group.claims.map((claim) => (
                <article
                  className={styles.claim}
                  data-status={claim.status}
                  key={claim.id}
                >
                  <div className={styles.claimHead}>
                    <div>
                      <input
                        aria-label="Detail label"
                        value={claim.label}
                        onChange={(event) =>
                          updateClaim(claim.id, {
                            label: event.target.value,
                            status: "edited",
                          })
                        }
                      />
                      <select
                        aria-label={`${claim.label} section`}
                        value={claim.category}
                        onChange={(event) =>
                          updateClaim(claim.id, {
                            category: event.target.value as ResumeClaimCategory,
                            status: "edited",
                          })
                        }
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {categoryLabels[category]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span>{claim.status.replace("_", " ")}</span>
                  </div>
                  <label className={styles.editableField}>
                    <span>
                      Resume text <small>Edit if needed</small>
                    </span>
                    <textarea
                      aria-label={`${claim.label} value`}
                      value={claim.value}
                      onChange={(event) =>
                        updateClaim(claim.id, {
                          value: event.target.value,
                          status: "edited",
                        })
                      }
                    />
                  </label>
                  <div className={styles.claimActions}>
                    <button
                      onClick={() =>
                        updateClaim(claim.id, { status: "confirmed" })
                      }
                      type="button"
                    >
                      ✓ Confirm
                    </button>
                    <button
                      onClick={() =>
                        updateClaim(claim.id, { status: "rejected" })
                      }
                      type="button"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => moveClaim(claim.id, -1)}
                      type="button"
                      aria-label="Move detail up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveClaim(claim.id, 1)}
                      type="button"
                      aria-label="Move detail down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => {
                        setHasUnsavedChanges(true);
                        setSaveNotice(null);
                        setClaims((current) =>
                          current.filter((item) => item.id !== claim.id),
                        );
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>

        <div className={styles.footerActions}>
          <button className={styles.addButton} onClick={addClaim} type="button">
            + Add a detail
          </button>
          <div>
            <span>{claims.length - reviewedCount} still need review</span>
            <button
              className={styles.saveButton}
              disabled={
                isSaving ||
                (!hasUnsavedChanges &&
                  (verification.status === "verified" || Boolean(saveNotice)))
              }
              onClick={() => void save()}
              type="button"
            >
              {isSaving
                ? "Saving…"
                : !hasUnsavedChanges && verification.status === "verified"
                  ? "Baseline saved"
                  : !hasUnsavedChanges && saveNotice
                    ? "Progress saved"
                    : reviewedCount === claims.length && claims.length > 0
                      ? "Save verified baseline"
                      : "Save progress"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
