"use client";

import type {
  ResumeSummary,
  TailoringSession,
} from "@make-my-resume/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import styles from "@/app/dashboard/dashboard.module.css";
import { authClient } from "@/lib/auth/client";
import { deleteResume, listResumes } from "@/lib/resume/import-client";
import { listTailoringSessions } from "@/lib/tailoring/client";

import { ResumeUploadDialog } from "./resume-upload-dialog";
import { WorkspaceNavigation } from "./workspace-navigation";

type CollectionPage = "activity" | "resumes";
type CollectionIcon = "activity" | "document" | "upload";

function Icon({ name }: { name: CollectionIcon }) {
  const paths: Record<CollectionIcon, ReactNode> = {
    activity: <path d="M3 12h4l2.2-6 3.6 12 2.2-6H21" />,
    document: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" />
        <path d="M5 14v6h14v-6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      fill="none"
      viewBox="0 0 24 24"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "ME";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function importStatusLabel(status: ResumeSummary["importStatus"]) {
  const labels: Record<ResumeSummary["importStatus"], string> = {
    awaiting_upload: "Awaiting upload",
    cancelled: "Cancelled",
    failed: "Upload failed",
    uploaded: "Uploaded",
    verifying: "Verifying",
  };
  return labels[status];
}

function resumeStatusLabel(resume: ResumeSummary) {
  if (resume.compatibilityStatus === "unsupported_legacy_format") {
    return "Unsupported image import";
  }
  if (resume.extractionStatus === "queued") return "Extraction queued";
  if (resume.extractionStatus === "processing") return "Extracting";
  if (resume.extractionStatus === "review_required") return "Review needed";
  if (resume.extractionStatus === "verified") return "Verified";
  if (resume.extractionStatus === "failed") return "Extraction failed";
  return importStatusLabel(resume.importStatus);
}

function formatUpdatedAt(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Recently updated";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}

function subscribeToLocalClock() {
  return () => {};
}

function getClientYear() {
  return String(new Date().getFullYear());
}

function getServerYear() {
  return "";
}

function resumeActivityHref(resume: ResumeSummary) {
  if (resume.compatibilityStatus === "supported" && resume.extractionStatus) {
    return `/resumes/${resume.id}/verify`;
  }
  return null;
}

type ActivityItem = {
  href: string | null;
  id: string;
  message: string;
  status: string;
  timestamp: string;
  title: string;
};

function buildActivityItems(
  resumes: ResumeSummary[],
  tailoringSessions: TailoringSession[],
) {
  const items: ActivityItem[] = [
    ...resumes.map((resume) => ({
      href: resumeActivityHref(resume),
      id: `resume:${resume.id}`,
      message:
        resume.compatibilityStatus === "unsupported_legacy_format"
          ? "needs a supported PDF or DOCX replacement"
          : resume.extractionStatus === "verified"
            ? "verified baseline ready"
            : resume.extractionStatus === "review_required"
              ? "extraction ready for review"
              : resume.importStatus === "uploaded"
                ? "uploaded securely"
                : importStatusLabel(resume.importStatus).toLowerCase(),
      status:
        resume.compatibilityStatus === "unsupported_legacy_format"
          ? "failed"
          : (resume.extractionStatus ?? resume.importStatus),
      timestamp: resume.updatedAt,
      title: resume.name,
    })),
    ...tailoringSessions.map((session) => ({
      href:
        session.status === "completed"
          ? `/tailoring/${session.id}/resume`
          : `/tailoring/${session.id}`,
      id: `tailoring:${session.id}`,
      message:
        session.status === "completed"
          ? "tailored version ready"
          : session.status === "review"
            ? "suggestions ready to review"
            : session.status === "failed"
              ? "tailoring needs attention"
              : "tailoring in progress",
      status:
        session.status === "completed"
          ? "uploaded"
          : session.status === "failed"
            ? "failed"
            : "verifying",
      timestamp: session.updatedAt,
      title: session.company || session.role || "Tailored resume",
    })),
  ];

  return items.sort(
    (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
  );
}

export function WorkspaceCollectionPage({ page }: { page: CollectionPage }) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const authenticatedUserId = data?.user.id;
  const currentYear = useSyncExternalStore(
    subscribeToLocalClock,
    getClientYear,
    getServerYear,
  );
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [tailoringSessions, setTailoringSessions] = useState<
    TailoringSession[]
  >([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);
  const [isLoadingTailoring, setIsLoadingTailoring] = useState(
    page === "activity",
  );
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [tailoringError, setTailoringError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [resumePendingDeletion, setResumePendingDeletion] =
    useState<ResumeSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshResumes = useCallback(async () => {
    setIsLoadingResumes(true);
    setResumeError(null);
    try {
      setResumes(await listResumes());
    } catch {
      setResumeError(
        "We could not load your resume library. Refresh the page to try again.",
      );
    } finally {
      setIsLoadingResumes(false);
    }
  }, []);

  const refreshTailoringSessions = useCallback(async () => {
    setIsLoadingTailoring(true);
    setTailoringError(null);
    try {
      setTailoringSessions(await listTailoringSessions());
    } catch {
      setTailoringError(
        "We could not load your tailoring activity. Please try again.",
      );
    } finally {
      setIsLoadingTailoring(false);
    }
  }, []);

  useEffect(() => {
    if (!isPending && !data) {
      const redirect = page === "resumes" ? "%2Fresumes" : "%2Factivity";
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [data, isPending, page, router]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    let cancelled = false;

    void listResumes()
      .then((nextResumes) => {
        if (!cancelled) setResumes(nextResumes);
      })
      .catch(() => {
        if (!cancelled) {
          setResumeError(
            "We could not load your resume library. Refresh the page to try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingResumes(false);
      });

    if (page === "activity") {
      void listTailoringSessions()
        .then((nextSessions) => {
          if (!cancelled) setTailoringSessions(nextSessions);
        })
        .catch(() => {
          if (!cancelled) {
            setTailoringError(
              "We could not load your tailoring activity. Please try again.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoadingTailoring(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId, page]);

  const activityItems = useMemo(
    () => buildActivityItems(resumes, tailoringSessions),
    [resumes, tailoringSessions],
  );

  async function signOut() {
    setNotice(null);
    setIsSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setNotice(
          result.error.message ??
            "We could not end your session. Please try again.",
        );
        return;
      }
      window.location.replace("/login");
    } catch {
      setNotice(
        "The authentication service is unavailable. Your session is still active.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  async function confirmResumeDeletion() {
    if (!resumePendingDeletion || isDeleting) return;
    const resume = resumePendingDeletion;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteResume(resume.id);
      setResumes((current) =>
        current.filter((candidate) => candidate.id !== resume.id),
      );
      setResumePendingDeletion(null);
      setNotice(`“${resume.name}” was permanently deleted.`);
    } catch {
      setDeleteError(
        "We could not delete this resume from cloud storage. Please try again.",
      );
    } finally {
      setIsDeleting(false);
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

  const initials = getInitials(data.user.name);
  const loading =
    isLoadingResumes || (page === "activity" && isLoadingTailoring);

  return (
    <div className={styles.page}>
      <WorkspaceNavigation
        active={page}
        email={data.user.email}
        initials={initials}
        isSigningOut={isSigningOut}
        name={data.user.name}
        onNotifications={() =>
          setNotice("You’re all caught up—there are no new notifications.")
        }
        onSignOut={() => void signOut()}
      />

      <main className={`${styles.main} ${styles.collectionMain}`}>
        <section className={styles.collectionHeader}>
          <div>
            <span>
              {page === "resumes" ? "Resume workspace" : "Workspace log"}
            </span>
            <h1>
              {page === "resumes" ? "Resume library" : "Activity history"}
            </h1>
            <p>
              {page === "resumes"
                ? "Open, verify, tailor, or remove every resume saved to your account."
                : "Review every resume and tailoring workflow currently associated with your account."}
            </p>
          </div>
          {page === "resumes" && (
            <button
              className={styles.primaryButton}
              onClick={() => setIsUploadOpen(true)}
              type="button"
            >
              <Icon name="upload" /> Upload resume
            </button>
          )}
        </section>

        {notice && (
          <div className={styles.featureNotice} role="status">
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        {resumeError && (
          <div className={styles.libraryError} role="alert">
            <span>{resumeError}</span>
            <button onClick={() => void refreshResumes()} type="button">
              Try again
            </button>
          </div>
        )}
        {page === "activity" && tailoringError && (
          <div className={styles.libraryError} role="alert">
            <span>{tailoringError}</span>
            <button
              onClick={() => void refreshTailoringSessions()}
              type="button"
            >
              Try again
            </button>
          </div>
        )}

        {page === "resumes" ? (
          <section className={styles.resumeSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>All resumes</h2>
                <span>{resumes.length} total</span>
              </div>
            </div>

            {isLoadingResumes && resumes.length === 0 ? (
              <div className={styles.libraryLoading} aria-live="polite">
                Loading your resume library…
              </div>
            ) : resumes.length > 0 ? (
              <div className={styles.resumeGrid}>
                {resumes.map((resume) => (
                  <article className={styles.resumeCard} key={resume.id}>
                    <div className={styles.resumePreview} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className={styles.resumeDetails}>
                      <span
                        className={styles.resumeStatus}
                        data-status={
                          resume.compatibilityStatus ===
                          "unsupported_legacy_format"
                            ? "unsupported"
                            : (resume.extractionStatus ?? resume.importStatus)
                        }
                      >
                        {resumeStatusLabel(resume)}
                      </span>
                      <h3>{resume.name}</h3>
                      <p>{resume.originalFileName}</p>
                      <small>{formatUpdatedAt(resume.updatedAt)}</small>
                    </div>
                    <div className={styles.resumeCardFooter}>
                      <span>
                        {resume.compatibilityStatus ===
                        "unsupported_legacy_format"
                          ? "Replace with a PDF or DOCX to continue"
                          : resume.extractionStatus === "verified"
                            ? "Baseline ready"
                            : resume.importStatus === "uploaded"
                              ? "Original preserved"
                              : "Import needs attention"}
                      </span>
                      <div className={styles.resumeActions}>
                        {resume.compatibilityStatus ===
                          "unsupported_legacy_format" && (
                          <button
                            onClick={() => setIsUploadOpen(true)}
                            type="button"
                          >
                            Upload PDF/DOCX
                          </button>
                        )}
                        {resume.compatibilityStatus === "supported" &&
                          resume.extractionStatus && (
                            <Link href={`/resumes/${resume.id}/verify`}>
                              {resume.extractionStatus === "verified"
                                ? "View baseline"
                                : resume.extractionStatus === "failed"
                                  ? "Resolve"
                                  : "Review extraction"}
                            </Link>
                          )}
                        {resume.compatibilityStatus === "supported" &&
                          resume.extractionStatus === "verified" && (
                            <Link href={`/resumes/${resume.id}/tailor`}>
                              Tailor to a job →
                            </Link>
                          )}
                        {resume.importStatus === "failed" && (
                          <button
                            onClick={() => setIsUploadOpen(true)}
                            type="button"
                          >
                            Upload again
                          </button>
                        )}
                        <button
                          aria-label={`Delete ${resume.name}`}
                          className={styles.deleteResumeButton}
                          onClick={() => {
                            setDeleteError(null);
                            setResumePendingDeletion(resume);
                          }}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyLibrary}>
                <div className={styles.emptyDocument} aria-hidden="true">
                  <Icon name="document" />
                </div>
                <div>
                  <span>Your verified baseline starts here</span>
                  <h3>Bring your experience into one trusted workspace.</h3>
                  <p>
                    Upload a PDF or DOCX resume, then verify every extracted
                    detail before tailoring it to a role.
                  </p>
                </div>
                <button
                  className={styles.primaryButton}
                  onClick={() => setIsUploadOpen(true)}
                  type="button"
                >
                  <Icon name="upload" /> Upload your first resume
                </button>
              </div>
            )}
          </section>
        ) : (
          <section
            aria-labelledby="all-activity-title"
            className={`${styles.activityCard} ${styles.activityPageCard}`}
          >
            <div className={styles.cardHeading}>
              <h2 id="all-activity-title">All activity</h2>
              <span>{activityItems.length} records</span>
            </div>
            {loading && activityItems.length === 0 ? (
              <div className={styles.libraryLoading} aria-live="polite">
                Loading your activity…
              </div>
            ) : activityItems.length > 0 ? (
              <ol className={styles.activityList}>
                {activityItems.map((item) => (
                  <li key={item.id}>
                    <i data-status={item.status} />
                    <span>
                      <strong>{item.title}</strong> {item.message}
                    </span>
                    <div className={styles.activityItemActions}>
                      <small>
                        {formatUpdatedAt(item.timestamp).replace(
                          "Updated ",
                          "",
                        )}
                      </small>
                      {item.href && <Link href={item.href}>Open</Link>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.emptyActivity}>
                <Icon name="activity" />
                <div>
                  <strong>No activity yet</strong>
                  <p>
                    Your resume imports, verifications, and tailored workflows
                    will appear here.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <span>© {currentYear ? `${currentYear} ` : ""}Make My Resume</span>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/#integrity">Methodology</Link>
          <a href="mailto:support@makemyresume.app">Support</a>
        </nav>
      </footer>

      {isUploadOpen && (
        <ResumeUploadDialog
          onClose={() => setIsUploadOpen(false)}
          onComplete={() => void refreshResumes()}
        />
      )}

      {resumePendingDeletion && (
        <div className={styles.deleteDialogBackdrop}>
          <section
            aria-labelledby="delete-resume-title"
            aria-modal="true"
            className={styles.deleteDialog}
            role="dialog"
          >
            <span>Permanent deletion</span>
            <h2 id="delete-resume-title">
              Delete “{resumePendingDeletion.name}”?
            </h2>
            <p>
              This removes the original file from Cloudflare storage along with
              its extracted baseline, tailored versions, and related activity.
              This action cannot be undone.
            </p>
            {deleteError && <div role="alert">{deleteError}</div>}
            <footer>
              <button
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError(null);
                  setResumePendingDeletion(null);
                }}
                type="button"
              >
                Keep resume
              </button>
              <button
                disabled={isDeleting}
                onClick={() => void confirmResumeDeletion()}
                type="button"
              >
                {isDeleting ? "Deleting…" : "Delete permanently"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
