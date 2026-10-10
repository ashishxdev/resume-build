"use client";

import type {
  ResumeClaim,
  ResumeExportFormat,
  ResumeTemplateDensity,
  ResumeVersion,
  ResumeVersionSummary,
} from "@make-my-resume/contracts";
import { buildProfessionalResumeDocument } from "@make-my-resume/resume-engine";
import { ProfessionalResume } from "@make-my-resume/resume-renderer";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import dashboardStyles from "@/app/dashboard/dashboard.module.css";
import { WorkspaceNavigation } from "@/components/dashboard/workspace-navigation";
import { authClient } from "@/lib/auth/client";
import {
  activateResumeVersion,
  deleteResumeVersion,
  downloadResumeVersion,
  getResumeVersion,
  listResumeVersions,
  renameResumeVersion,
  restoreResumeVersion,
} from "@/lib/resume/version-client";

import styles from "./resume-version-history.module.css";

type View = "preview" | "compare";

function initials(name?: string | null) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function typeLabel(type: ResumeVersionSummary["type"]) {
  return {
    base: "Verified baseline",
    tailored: "Tailored",
    ats_improved: "ATS improved",
    restored: "Restored copy",
  }[type];
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function claimKey(claim: ResumeClaim) {
  return claim.id;
}

function comparisonRows(left: ResumeVersion, right: ResumeVersion) {
  const leftClaims = new Map(
    left.claims.map((claim) => [claimKey(claim), claim]),
  );
  const rightClaims = new Map(
    right.claims.map((claim) => [claimKey(claim), claim]),
  );
  const keys = [...new Set([...leftClaims.keys(), ...rightClaims.keys()])];
  return keys
    .map((key) => {
      const leftClaim = leftClaims.get(key) ?? null;
      const rightClaim = rightClaims.get(key) ?? null;
      return {
        key,
        left: leftClaim,
        right: rightClaim,
        changed:
          leftClaim?.value !== rightClaim?.value ||
          leftClaim?.label !== rightClaim?.label ||
          leftClaim?.status !== rightClaim?.status,
        order: Math.min(
          leftClaim?.order ?? Number.MAX_SAFE_INTEGER,
          rightClaim?.order ?? Number.MAX_SAFE_INTEGER,
        ),
      };
    })
    .sort((left, right) => left.order - right.order);
}

export function ResumeVersionHistoryPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const router = useRouter();
  const { data: authSession, isPending } = authClient.useSession();
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof listResumeVersions>
  > | null>(null);
  const [details, setDetails] = useState<Record<string, ResumeVersion>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [view, setView] = useState<View>("preview");
  const [density, setDensity] = useState<ResumeTemplateDensity>("comfortable");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ResumeExportFormat | null>(
    null,
  );
  const [renaming, setRenaming] = useState<ResumeVersionSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<ResumeVersionSummary | null>(null);

  const refresh = useCallback(async () => {
    const next = await listResumeVersions(resumeId);
    setHistory(next);
    setSelectedId((current) =>
      current && next.versions.some((version) => version.id === current)
        ? current
        : (next.activeVersionId ?? next.versions.at(-1)?.id ?? null),
    );
    const baseline = next.versions.find((version) => version.type === "base");
    setLeftId((current) =>
      current && next.versions.some((version) => version.id === current)
        ? current
        : (baseline?.id ?? next.versions[0]?.id ?? null),
    );
    setRightId((current) =>
      current && next.versions.some((version) => version.id === current)
        ? current
        : (next.activeVersionId ?? next.versions.at(-1)?.id ?? null),
    );
    return next;
  }, [resumeId]);

  useEffect(() => {
    if (!isPending && !authSession) {
      router.replace(
        `/login?redirect=${encodeURIComponent(`/resumes/${resumeId}/versions`)}`,
      );
    }
  }, [authSession, isPending, resumeId, router]);

  useEffect(() => {
    if (!authSession) return;
    let cancelled = false;
    void listResumeVersions(resumeId)
      .then((next) => {
        if (cancelled) return;
        setHistory(next);
        const activeId =
          next.activeVersionId ?? next.versions.at(-1)?.id ?? null;
        const baseline = next.versions.find(
          (version) => version.type === "base",
        );
        setSelectedId(activeId);
        setLeftId(baseline?.id ?? next.versions[0]?.id ?? null);
        setRightId(activeId);
      })
      .catch((requestError: unknown) => {
        if (!cancelled)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "We could not load this version history.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authSession, resumeId]);

  useEffect(() => {
    if (!selectedId || details[selectedId]) return;
    let cancelled = false;
    void getResumeVersion(resumeId, selectedId)
      .then((version) => {
        if (!cancelled)
          setDetails((current) => ({ ...current, [version.id]: version }));
      })
      .catch((requestError: unknown) => {
        if (!cancelled)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "We could not load this resume version.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [details, resumeId, selectedId]);

  useEffect(() => {
    if (view !== "compare") return;
    let cancelled = false;
    for (const versionId of [leftId, rightId]) {
      if (versionId && !details[versionId])
        void getResumeVersion(resumeId, versionId)
          .then((version) => {
            if (!cancelled)
              setDetails((current) => ({
                ...current,
                [version.id]: version,
              }));
          })
          .catch((requestError: unknown) => {
            if (!cancelled)
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : "We could not load the comparison.",
              );
          });
    }
    return () => {
      cancelled = true;
    };
  }, [details, leftId, resumeId, rightId, view]);

  const selected = selectedId ? details[selectedId] : null;
  const document = useMemo(
    () => (selected ? buildProfessionalResumeDocument(selected.claims) : null),
    [selected],
  );
  const left = leftId ? details[leftId] : null;
  const right = rightId ? details[rightId] : null;
  const rows = useMemo(
    () => (left && right ? comparisonRows(left, right) : []),
    [left, right],
  );

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("We could not sign you out. Please try again.");
      setIsSigningOut(false);
    }
  }

  async function activate(version: ResumeVersionSummary) {
    if (pendingAction) return;
    setPendingAction(`activate:${version.id}`);
    setError(null);
    try {
      await activateResumeVersion(resumeId, version.id);
      await refresh();
      setNotice(`“${version.name}” is now the active version.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The version could not be activated.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function restore(version: ResumeVersionSummary) {
    if (pendingAction) return;
    setPendingAction(`restore:${version.id}`);
    setError(null);
    try {
      const restored = await restoreResumeVersion(resumeId, version.id);
      setDetails((current) => ({ ...current, [restored.id]: restored }));
      await refresh();
      setSelectedId(restored.id);
      setNotice("A new active copy was restored without rewriting history.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The version could not be restored.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function saveRename() {
    if (!renaming || pendingAction || !renameValue.trim()) return;
    setPendingAction(`rename:${renaming.id}`);
    setError(null);
    try {
      const updated = await renameResumeVersion(
        resumeId,
        renaming.id,
        renameValue,
      );
      setDetails((current) => ({ ...current, [updated.id]: updated }));
      await refresh();
      setRenaming(null);
      setNotice("Version name updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The version could not be renamed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmDelete() {
    if (!deleting || pendingAction) return;
    setPendingAction(`delete:${deleting.id}`);
    setError(null);
    try {
      await deleteResumeVersion(resumeId, deleting.id);
      setDetails((current) => {
        const next = { ...current };
        delete next[deleting.id];
        return next;
      });
      await refresh();
      setDeleting(null);
      setNotice(
        deleting.deleteScope === "tailoring_session"
          ? "The tailoring workflow and its generated versions were deleted."
          : "The resume version was permanently deleted.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The version could not be deleted.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function download(format: ResumeExportFormat) {
    if (!selected || downloading) return;
    setDownloading(format);
    setError(null);
    try {
      const exported = await downloadResumeVersion(
        resumeId,
        selected.id,
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
          : "The version could not be downloaded.",
      );
    } finally {
      setDownloading(null);
    }
  }

  if (isPending || !authSession || loading) {
    return (
      <main className={styles.centerState} aria-live="polite">
        <span />
        <p>Loading resume history…</p>
      </main>
    );
  }

  if (!history) {
    return (
      <main className={styles.centerState}>
        <strong>We couldn’t open this resume history.</strong>
        <p>{error}</p>
        <Link href="/resumes">Return to resumes</Link>
      </main>
    );
  }

  return (
    <div className={dashboardStyles.page}>
      <WorkspaceNavigation
        active="resumes"
        email={authSession.user.email}
        initials={initials(authSession.user.name)}
        isSigningOut={isSigningOut}
        name={authSession.user.name}
        onNotifications={() =>
          setNotice("You’re all caught up. There are no new notifications.")
        }
        onSignOut={() => void signOut()}
      />

      <main className={styles.page}>
        <Link className={styles.backLink} href="/resumes">
          ← All resumes
        </Link>
        <header className={styles.hero}>
          <div>
            <span>Immutable version history</span>
            <h1>{history.resumeName}</h1>
            <p>
              Compare, restore, and export every verified version without
              changing your original resume.
            </p>
          </div>
          <div
            className={styles.viewSwitch}
            aria-label="Version workspace view"
          >
            <button
              aria-pressed={view === "preview"}
              onClick={() => setView("preview")}
              type="button"
            >
              Preview
            </button>
            <button
              aria-pressed={view === "compare"}
              onClick={() => setView("compare")}
              type="button"
            >
              Compare
            </button>
          </div>
        </header>

        {(notice || error) && (
          <div
            className={error ? styles.errorNotice : styles.notice}
            role={error ? "alert" : "status"}
          >
            <span>{error ?? notice}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setError(null);
                setNotice(null);
              }}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        <div className={styles.workspace}>
          <aside className={styles.timeline}>
            <div className={styles.timelineHeading}>
              <div>
                <span>Version timeline</span>
                <strong>{history.versions.length} snapshots</strong>
              </div>
              <i aria-hidden="true" />
            </div>
            <ol>
              {[...history.versions].reverse().map((version) => (
                <li key={version.id}>
                  <button
                    aria-current={
                      selectedId === version.id ? "true" : undefined
                    }
                    className={
                      selectedId === version.id
                        ? styles.selectedVersion
                        : undefined
                    }
                    onClick={() => {
                      setSelectedId(version.id);
                      setView("preview");
                    }}
                    type="button"
                  >
                    <span data-type={version.type}>
                      {typeLabel(version.type)}
                    </span>
                    <strong>{version.name}</strong>
                    <small>{dateLabel(version.createdAt)}</small>
                    {version.isActive && <em>Active</em>}
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <section className={styles.content}>
            {view === "preview" ? (
              selected && document ? (
                <>
                  <header className={styles.versionToolbar}>
                    <div>
                      <span>
                        Version {selected.versionNumber} ·{" "}
                        {typeLabel(selected.type)}
                      </span>
                      <h2>{selected.name}</h2>
                      <p>
                        {[selected.company, selected.role]
                          .filter(Boolean)
                          .join(" · ") || "Verified resume snapshot"}
                      </p>
                    </div>
                    <div className={styles.toolbarActions}>
                      {!selected.isActive && (
                        <button
                          disabled={pendingAction !== null}
                          onClick={() => void activate(selected)}
                          type="button"
                        >
                          Set active
                        </button>
                      )}
                      <button
                        disabled={pendingAction !== null}
                        onClick={() => void restore(selected)}
                        type="button"
                      >
                        Restore as copy
                      </button>
                      <button
                        onClick={() => {
                          setRenaming(selected);
                          setRenameValue(selected.name);
                        }}
                        type="button"
                      >
                        Rename
                      </button>
                    </div>
                  </header>

                  <div className={styles.exportBar}>
                    <fieldset>
                      <legend>Spacing</legend>
                      <label>
                        <input
                          checked={density === "comfortable"}
                          name="history-density"
                          onChange={() => setDensity("comfortable")}
                          type="radio"
                        />
                        Comfortable
                      </label>
                      <label>
                        <input
                          checked={density === "compact"}
                          name="history-density"
                          onChange={() => setDensity("compact")}
                          type="radio"
                        />
                        Compact
                      </label>
                    </fieldset>
                    <button
                      disabled={downloading !== null}
                      onClick={() => void download("pdf")}
                      type="button"
                    >
                      {downloading === "pdf" ? "Creating PDF…" : "Download PDF"}
                    </button>
                    <button
                      disabled={downloading !== null}
                      onClick={() => void download("docx")}
                      type="button"
                    >
                      {downloading === "docx"
                        ? "Creating DOCX…"
                        : "Download DOCX"}
                    </button>
                    <button
                      className={styles.deleteButton}
                      disabled={!selected.canDelete}
                      onClick={() => setDeleting(selected)}
                      title={selected.deleteBlockedReason ?? undefined}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                  {!selected.canDelete && selected.deleteBlockedReason && (
                    <p className={styles.protectionNote}>
                      {selected.deleteBlockedReason}
                    </p>
                  )}
                  <div
                    className={styles.paperStage}
                    aria-label="Resume version preview"
                  >
                    <ProfessionalResume density={density} document={document} />
                  </div>
                </>
              ) : (
                <div className={styles.loadingPanel}>
                  Loading version preview…
                </div>
              )
            ) : (
              <div className={styles.compareWorkspace}>
                <header>
                  <div>
                    <span>Evidence-safe comparison</span>
                    <h2>See exactly what changed.</h2>
                  </div>
                  <p>Unchanged claims remain visible but visually quiet.</p>
                </header>
                <div className={styles.compareSelectors}>
                  <label>
                    Earlier version
                    <select
                      value={leftId ?? ""}
                      onChange={(event) => setLeftId(event.target.value)}
                    >
                      {history.versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          v{version.versionNumber} · {version.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span aria-hidden="true">→</span>
                  <label>
                    Later version
                    <select
                      value={rightId ?? ""}
                      onChange={(event) => setRightId(event.target.value)}
                    >
                      {history.versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          v{version.versionNumber} · {version.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {left && right ? (
                  <div className={styles.comparisonList}>
                    {rows.map((row) => (
                      <article data-changed={row.changed} key={row.key}>
                        <header>
                          <span>
                            {row.left?.category ?? row.right?.category}
                          </span>
                          <strong>
                            {row.changed ? "Changed" : "Unchanged"}
                          </strong>
                        </header>
                        <div>
                          <section>
                            <small>{left.name}</small>
                            <h3>{row.left?.label ?? "Not present"}</h3>
                            <p>{row.left?.value ?? "—"}</p>
                          </section>
                          <section>
                            <small>{right.name}</small>
                            <h3>{row.right?.label ?? "Not present"}</h3>
                            <p>{row.right?.value ?? "—"}</p>
                          </section>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.loadingPanel}>Loading comparison…</div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {renaming && (
        <div className={styles.dialogBackdrop}>
          <form
            aria-labelledby="rename-version-title"
            aria-modal="true"
            className={styles.dialog}
            onSubmit={(event) => {
              event.preventDefault();
              void saveRename();
            }}
            role="dialog"
          >
            <span>Version label</span>
            <h2 id="rename-version-title">Rename this version</h2>
            <label>
              Name
              <input
                autoFocus
                maxLength={120}
                onChange={(event) => setRenameValue(event.target.value)}
                required
                value={renameValue}
              />
            </label>
            <footer>
              <button onClick={() => setRenaming(null)} type="button">
                Cancel
              </button>
              <button disabled={pendingAction !== null} type="submit">
                {pendingAction ? "Saving…" : "Save name"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {deleting && (
        <div className={styles.dialogBackdrop}>
          <section
            aria-labelledby="delete-history-version-title"
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <span>Permanent deletion</span>
            <h2 id="delete-history-version-title">Delete “{deleting.name}”?</h2>
            <p>
              {deleting.deleteScope === "tailoring_session"
                ? "This version belongs to a tailoring workflow. The workflow and all of its generated versions will be deleted together. Your verified baseline remains safe."
                : "This restored copy will be permanently deleted. Your verified baseline remains safe."}
            </p>
            <footer>
              <button onClick={() => setDeleting(null)} type="button">
                Keep version
              </button>
              <button
                disabled={pendingAction !== null}
                onClick={() => void confirmDelete()}
                type="button"
              >
                {pendingAction ? "Deleting…" : "Delete permanently"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
