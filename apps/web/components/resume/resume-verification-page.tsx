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
  const [isRetrying, setIsRetrying] = useState(false);
  const [pollGeneration, setPollGeneration] = useState(0);

  const load = useCallback(async () => {
    try {
      const next = await getResumeVerification(resumeId);
      setVerification(next);
      setClaims(next.claims);
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
    setClaims((current) =>
      current.map((claim) =>
        claim.id === id ? { ...claim, ...patch } : claim,
      ),
    );
  }

  function moveClaim(id: string, direction: -1 | 1) {
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
    return (
      <main className={styles.statePage}>
        <span className={styles.eyebrow}>Extraction needs attention</span>
        <h1>We couldn’t read this document.</h1>
        <p>
          {verification.failureMessage ??
            "Try the original again or upload a text-based PDF or DOCX."}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className={styles.stateActions}>
          <button
            disabled={isRetrying}
            onClick={() => void retry()}
            type="button"
          >
            {isRetrying ? "Retrying…" : "Retry extraction"}
          </button>
          <Link href="/dashboard">Return to dashboard</Link>
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
            Confirm what we extracted, correct anything we misread, or reject
            details that should not be used. Source text remains visible for
            traceability.
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
                  {claim.sourceText && (
                    <blockquote>
                      <b>
                        Source
                        {claim.pageNumber ? ` · page ${claim.pageNumber}` : ""}
                      </b>
                      {claim.sourceText}
                    </blockquote>
                  )}
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
                      onClick={() =>
                        setClaims((current) =>
                          current.filter((item) => item.id !== claim.id),
                        )
                      }
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
              disabled={isSaving}
              onClick={() => void save()}
              type="button"
            >
              {isSaving
                ? "Saving…"
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
