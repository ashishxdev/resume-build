"use client";

import type {
  ResumeExportFormat,
  ResumeClaimCategory,
  ResumeTemplateDensity,
  TailoringSession,
  TailoringSuggestion,
} from "@make-my-resume/contracts";
import { buildProfessionalResumeDocument } from "@make-my-resume/resume-engine";
import { ProfessionalResume } from "@make-my-resume/resume-renderer";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "./workspace-shell";
import styles from "./tailoring.module.css";
import { authClient } from "@/lib/auth/client";
import {
  completeTailoringSession,
  decideAll,
  decideSuggestion,
  downloadTailoredResume,
  getTailoringSession,
  retryTailoringSession,
} from "@/lib/tailoring/client";

type Filter = "all" | ResumeClaimCategory;

function sectionLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchScore(session: TailoringSession) {
  const matches = session.analysis.matches;
  if (!matches.length) return 0;
  const value = matches.reduce(
    (total, match) =>
      total +
      (match.status === "strong" ? 1 : match.status === "partial" ? 0.5 : 0),
    0,
  );
  return Math.round((value / matches.length) * 100);
}

export function TailoringSessionPage() {
  const { tailoringSessionId } = useParams<{ tailoringSessionId: string }>();
  const router = useRouter();
  const { data: authSession, isPending } = authClient.useSession();
  const [session, setSession] = useState<TailoringSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [density, setDensity] = useState<ResumeTemplateDensity>("comfortable");
  const [downloading, setDownloading] = useState<ResumeExportFormat | null>(
    null,
  );

  useEffect(() => {
    if (!isPending && !authSession)
      router.replace(
        `/login?redirect=${encodeURIComponent(`/tailoring/${tailoringSessionId}`)}`,
      );
  }, [authSession, isPending, router, tailoringSessionId]);

  useEffect(() => {
    if (!authSession) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastKnownActive = false;
    const load = async () => {
      try {
        const next = await getTailoringSession(tailoringSessionId);
        if (cancelled) return;
        setSession(next);
        setError(null);
        setLoading(false);
        lastKnownActive = ["queued", "generating"].includes(next.status);
        if (lastKnownActive) timeout = setTimeout(() => void load(), 1_000);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "We could not load this tailoring session.",
          );
          setLoading(false);
          if (lastKnownActive) timeout = setTimeout(() => void load(), 2_500);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [authSession, refreshKey, tailoringSessionId]);

  const requirements = useMemo(
    () =>
      new Map(
        session?.analysis.requirements.map((item) => [item.id, item]) ?? [],
      ),
    [session],
  );
  const counts = useMemo(() => {
    const suggestions = session?.suggestions ?? [];
    return {
      total: suggestions.length,
      pending: suggestions.filter((item) => item.status === "pending").length,
      accepted: suggestions.filter((item) => item.status === "accepted").length,
      rejected: suggestions.filter((item) => item.status === "rejected").length,
      edited: suggestions.filter((item) => item.editedText).length,
    };
  }, [session]);
  const sections = useMemo(
    () => [
      ...new Set((session?.suggestions ?? []).map((item) => item.section)),
    ],
    [session],
  );
  const visibleSuggestions = (session?.suggestions ?? []).filter(
    (suggestion) => filter === "all" || suggestion.section === filter,
  );
  const resumeDocument = useMemo(() => {
    if (!session?.finalClaims) return null;
    const claims =
      session.atsImprovementActive && session.atsImprovedClaims
        ? session.atsImprovedClaims
        : session.finalClaims;
    return buildProfessionalResumeDocument(claims, {
      tailoredClaimIds: session.suggestions
        .filter((suggestion) => suggestion.status === "accepted")
        .map((suggestion) => suggestion.sourceClaimId),
    });
  }, [session]);

  async function updateSuggestion(
    suggestion: TailoringSuggestion,
    status: "accepted" | "rejected",
    editedText?: string | null,
  ) {
    if (!session || saving) return;
    setSaving(true);
    setError(null);
    try {
      setSession(
        await decideSuggestion(session, suggestion.id, status, editedText),
      );
      setEditing(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The decision could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAll(decision: "accept-all" | "reject-all") {
    if (!session || saving) return;
    setSaving(true);
    try {
      setSession(await decideAll(session, decision));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The decisions could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    if (!session || saving) return;
    setSaving(true);
    try {
      setSession(await completeTailoringSession(session));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The tailored version could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function retry() {
    if (!session) return;
    setSaving(true);
    try {
      const next = await retryTailoringSession(session.id);
      setSession(next);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Retry failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function download(format: ResumeExportFormat) {
    if (!session || downloading) return;
    setDownloading(format);
    setError(null);
    try {
      const exported = await downloadTailoredResume(
        session.id,
        format,
        density,
      );
      const url = URL.createObjectURL(exported.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      anchor.hidden = true;
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The resume could not be downloaded.",
      );
    } finally {
      setDownloading(null);
    }
  }

  if (isPending || !authSession || loading) {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.spinner} />
          <p>Opening your tailoring workspace…</p>
        </main>
      </WorkspaceShell>
    );
  }

  if (!session || (error && !session)) {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.failureIcon}>!</span>
          <h1>We couldn’t open this session.</h1>
          <p>{error}</p>
          <Link href="/dashboard">Return to dashboard</Link>
        </main>
      </WorkspaceShell>
    );
  }

  if (["queued", "generating"].includes(session.status)) {
    return (
      <WorkspaceShell>
        <main className={styles.generationPage} aria-live="polite">
          <Link
            className={styles.breadcrumb}
            href={`/job-descriptions/${session.jobDescriptionId}`}
          >
            ← Match overview
          </Link>
          <section className={styles.generationHero}>
            <span className={styles.eyebrow}>Evidence-backed tailoring</span>
            <h1>
              Tailoring your resume
              <br />
              <em>without changing your story.</em>
            </h1>
            <p>
              We’re creating conservative suggestions using only your verified
              experience.
            </p>
          </section>
          <div className={styles.generationGrid}>
            <section className={styles.progressCard}>
              <div className={styles.progressHeading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Generating grounded suggestions</strong>
                  <small>You can leave this page and return safely.</small>
                </div>
              </div>
              <ol>
                <li data-state="done">
                  <b>✓</b>
                  <span>
                    <strong>Job description analyzed</strong>
                    <small>
                      {session.analysis.requirements.length} requirements mapped
                    </small>
                  </span>
                </li>
                <li data-state="done">
                  <b>✓</b>
                  <span>
                    <strong>Resume evidence matched</strong>
                    <small>
                      {session.evidenceClaims.length} verified claims preserved
                    </small>
                  </span>
                </li>
                <li data-state="active">
                  <b>3</b>
                  <span>
                    <strong>Suggestions being prepared</strong>
                    <small>Improving relevance without adding facts</small>
                  </span>
                </li>
                <li>
                  <b>4</b>
                  <span>
                    <strong>Grounding and safety checks</strong>
                    <small>Unsupported wording will be discarded</small>
                  </span>
                </li>
              </ol>
            </section>
            <aside className={styles.generationAside}>
              <span className={styles.eyebrow}>Target role</span>
              <h2>{session.role ?? "Target role"}</h2>
              <p>{session.company ?? "Saved job description"}</p>
              <strong>{matchScore(session)}%</strong>
              <small>Evidence match</small>
              <hr />
              <p>✓ Your verified resume remains unchanged.</p>
              <p>✓ Every suggestion must cite supporting evidence.</p>
            </aside>
          </div>
          {error && (
            <div className={styles.pollNotice} role="status">
              {error} We’ll keep trying automatically.
            </div>
          )}
        </main>
      </WorkspaceShell>
    );
  }

  if (session.status === "failed") {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.failureIcon}>!</span>
          <h1>Suggestions need another look.</h1>
          <p>{session.failureMessage}</p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.centerActions}>
            <button disabled={saving} onClick={() => void retry()}>
              {saving ? "Retrying…" : "Try again"}
            </button>
            <Link href={`/job-descriptions/${session.jobDescriptionId}`}>
              Return to match overview
            </Link>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  if (session.status === "completed") {
    return (
      <WorkspaceShell>
        <main className={styles.completedPage}>
          <Link className={styles.breadcrumb} href="/dashboard">
            ← Dashboard / Tailored version
          </Link>
          <section className={styles.completedHero}>
            <div>
              <span className={styles.successMark}>✓</span>
              <span className={styles.eyebrow}>Tailored version saved</span>
              <h1>Your {session.company ?? "tailored"} resume is ready.</h1>
              <p>
                A new version was created. Your verified base resume was not
                changed.
              </p>
            </div>
            <div className={styles.integrityBadge}>
              <strong>Zero unsupported claims</strong>
              <span>Every edit remains traceable to verified evidence.</span>
            </div>
          </section>
          <div className={styles.completedGrid}>
            <section
              aria-label="Tailored resume document"
              className={`${styles.paperStage} ${styles.completedPaperStage}`}
            >
              {resumeDocument ? (
                <ProfessionalResume
                  density={density}
                  document={resumeDocument}
                />
              ) : (
                <div className={styles.previewUnavailable}>
                  <strong>The formatted preview is not available yet.</strong>
                  <span>Your saved tailoring decisions are still safe.</span>
                </div>
              )}
            </section>
            <aside className={styles.versionSummary}>
              <span className={styles.eyebrow}>Version summary</span>
              <h2>Tailored version 1</h2>
              <dl>
                <div>
                  <dt>Accepted</dt>
                  <dd>{counts.accepted}</dd>
                </div>
                <div>
                  <dt>Rejected</dt>
                  <dd>{counts.rejected}</dd>
                </div>
                <div>
                  <dt>Manually edited</dt>
                  <dd>{counts.edited}</dd>
                </div>
                <div>
                  <dt>Evidence match</dt>
                  <dd>{matchScore(session)}%</dd>
                </div>
              </dl>
              <fieldset className={styles.completedDensityControls}>
                <legend>Resume spacing</legend>
                <label>
                  <input
                    checked={density === "comfortable"}
                    name="completed-density"
                    onChange={() => setDensity("comfortable")}
                    type="radio"
                  />
                  <span>Comfortable</span>
                </label>
                <label>
                  <input
                    checked={density === "compact"}
                    name="completed-density"
                    onChange={() => setDensity("compact")}
                    type="radio"
                  />
                  <span>Compact</span>
                </label>
              </fieldset>
              <div className={styles.completedDownloadActions}>
                <button
                  disabled={downloading !== null || !resumeDocument}
                  onClick={() => void download("pdf")}
                  type="button"
                >
                  {downloading === "pdf" ? "Creating PDF…" : "Download PDF"}
                </button>
                <button
                  disabled={downloading !== null || !resumeDocument}
                  onClick={() => void download("docx")}
                  type="button"
                >
                  {downloading === "docx"
                    ? "Creating DOCX…"
                    : "Download editable DOCX"}
                </button>
              </div>
              <Link href="/resumes">View all resumes</Link>
              <Link href={`/tailoring/${session.id}/ats`}>
                Continue to ATS review
              </Link>
              <Link href={`/job-descriptions/${session.jobDescriptionId}`}>
                Compare with match overview
              </Link>
              {error && (
                <div className={styles.infoNotice} role="status">
                  {error}
                </div>
              )}
            </aside>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <main className={styles.reviewPage}>
        <Link
          className={styles.breadcrumb}
          href={`/job-descriptions/${session.jobDescriptionId}`}
        >
          ← Dashboard / Match overview / Suggestions
        </Link>
        <section className={styles.reviewHero}>
          <div>
            <span className={styles.eyebrow}>Human approval required</span>
            <h1>Review your tailored suggestions</h1>
            <p>
              Nothing changes until you approve it. Every edit is tied to
              verified evidence.
            </p>
          </div>
          <div className={styles.reviewScore}>
            <span>{matchScore(session)}%</span>
            <small>Current evidence match</small>
          </div>
        </section>
        <section className={styles.reviewStats}>
          <div>
            <strong>{counts.total}</strong>
            <span>Total suggestions</span>
          </div>
          <div>
            <strong>{counts.pending}</strong>
            <span>Pending</span>
          </div>
          <div>
            <strong>{counts.accepted}</strong>
            <span>Accepted</span>
          </div>
          <div>
            <strong>{counts.rejected}</strong>
            <span>Rejected</span>
          </div>
        </section>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <div className={styles.reviewGrid}>
          <aside className={styles.sectionFilters}>
            <h2>Resume sections</h2>
            <button
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              <span>All suggestions</span>
              <b>{counts.total}</b>
            </button>
            {sections.map((section) => (
              <button
                aria-pressed={filter === section}
                key={section}
                onClick={() => setFilter(section as Filter)}
              >
                <span>{sectionLabel(section)}</span>
                <b>
                  {
                    session.suggestions.filter(
                      (item) => item.section === section,
                    ).length
                  }
                </b>
              </button>
            ))}
            <div>
              <strong>Verified base protected</strong>
              <p>Rejected suggestions leave your wording unchanged.</p>
            </div>
          </aside>
          <section className={styles.suggestionList}>
            <div className={styles.bulkActions}>
              <span>{counts.pending} decisions remaining</span>
              <button
                disabled={saving}
                onClick={() => void updateAll("reject-all")}
              >
                Reject all
              </button>
              <button
                disabled={saving}
                onClick={() => void updateAll("accept-all")}
              >
                Accept all
              </button>
            </div>
            {visibleSuggestions.map((suggestion, index) => {
              const linked = suggestion.requirementIds
                .map((id) => requirements.get(id))
                .filter(Boolean);
              return (
                <article
                  className={styles.suggestionCard}
                  data-status={suggestion.status}
                  key={suggestion.id}
                >
                  <header>
                    <div>
                      <span>
                        {sectionLabel(suggestion.section)} · Suggestion{" "}
                        {index + 1}
                      </span>
                      <strong>{suggestion.status}</strong>
                    </div>
                    <small>Source: verified resume claim</small>
                  </header>
                  <div className={styles.comparison}>
                    <div>
                      <span>Original</span>
                      <p>{suggestion.originalText}</p>
                    </div>
                    <div>
                      <span>Proposed</span>
                      {editing === suggestion.id ? (
                        <textarea
                          aria-label="Edit suggested wording"
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                        />
                      ) : (
                        <p>
                          {suggestion.editedText ?? suggestion.suggestedText}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={styles.suggestionReason}>
                    <strong>Why this helps</strong>
                    <p>{suggestion.reason}</p>
                    <small>
                      Job requirement:{" "}
                      {linked.map((item) => item?.label).join(", ")}
                    </small>
                  </div>
                  <details>
                    <summary>View supporting evidence</summary>
                    <blockquote>“{suggestion.originalText}”</blockquote>
                    <p>
                      ✓ Source-verified claim from your bound resume version.
                    </p>
                  </details>
                  <footer>
                    {editing === suggestion.id ? (
                      <>
                        <button
                          disabled={saving || !editText.trim()}
                          onClick={() =>
                            void updateSuggestion(
                              suggestion,
                              "accepted",
                              editText.trim(),
                            )
                          }
                        >
                          Save and accept
                        </button>
                        <button onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={saving || suggestion.status === "accepted"}
                          onClick={() =>
                            void updateSuggestion(
                              suggestion,
                              "accepted",
                              suggestion.editedText,
                            )
                          }
                        >
                          {suggestion.status === "accepted"
                            ? "✓ Accepted"
                            : "✓ Accept"}
                        </button>
                        <button
                          disabled={saving}
                          onClick={() =>
                            void updateSuggestion(suggestion, "rejected")
                          }
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            setEditing(suggestion.id);
                            setEditText(
                              suggestion.editedText ?? suggestion.suggestedText,
                            );
                          }}
                        >
                          Edit wording
                        </button>
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
          </section>
        </div>
        <section className={styles.reviewDock}>
          <div>
            <strong>
              {counts.pending
                ? `${counts.pending} decisions remaining`
                : "Every suggestion reviewed"}
            </strong>
            <span>Your base resume stays unchanged.</span>
          </div>
          <button
            disabled={saving || counts.pending > 0}
            onClick={() => void finish()}
          >
            {saving ? "Saving…" : "Create tailored version →"}
          </button>
        </section>
      </main>
    </WorkspaceShell>
  );
}
