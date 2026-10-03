"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ResumeSummary } from "@make-my-resume/contracts";

import { ResumeUploadDialog } from "@/components/dashboard/resume-upload-dialog";
import { authClient } from "@/lib/auth/client";
import { listResumes } from "@/lib/resume/import-client";

import styles from "./dashboard.module.css";

type IconName =
  | "activity"
  | "bell"
  | "document"
  | "dashboard"
  | "plus"
  | "profile"
  | "shield"
  | "upload";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M3 12h4l2.2-6 3.6 12 2.2-6H21" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    document: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.8 3 8.2 7.5 9.5 4.5-1.3 7.5-4.7 7.5-9.5V6z" />
        <path d="m9 12 2 2 4-4" />
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

function getGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function subscribeToLocalClock() {
  return () => {};
}

function getClientGreeting() {
  return getGreeting(new Date());
}

function getServerGreeting() {
  return "Welcome back";
}

function getClientYear() {
  return String(new Date().getFullYear());
}

function getServerYear() {
  return "";
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
    verifying: "Verifying",
    uploaded: "Uploaded",
    failed: "Upload failed",
    cancelled: "Cancelled",
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

export default function DashboardPage() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const authenticatedUserId = data?.user.id;
  const greeting = useSyncExternalStore(
    subscribeToLocalClock,
    getClientGreeting,
    getServerGreeting,
  );
  const currentYear = useSyncExternalStore(
    subscribeToLocalClock,
    getClientYear,
    getServerYear,
  );
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [featureNotice, setFeatureNotice] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  const refreshResumes = useCallback(async () => {
    setIsLoadingLibrary(true);
    setLibraryError(null);
    try {
      setResumes(await listResumes());
    } catch {
      setLibraryError(
        "We could not load your resume library. Refresh the page to try again.",
      );
    } finally {
      setIsLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    if (!isPending && !data) {
      router.replace("/login?redirect=%2Fdashboard");
    }
  }, [data, isPending, router]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    let cancelled = false;

    void listResumes()
      .then((nextResumes) => {
        if (!cancelled) setResumes(nextResumes);
      })
      .catch(() => {
        if (!cancelled) {
          setLibraryError(
            "We could not load your resume library. Refresh the page to try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLibrary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId]);

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

  function announceCreateFeature() {
    setFeatureNotice(
      "Creating a resume from scratch will be added after resume import and verification.",
    );
  }

  function showNotifications() {
    setFeatureNotice("You’re all caught up—there are no new notifications.");
  }

  function showUpgradeStatus() {
    setFeatureNotice(
      "Plan upgrades will be available when billing is introduced. Your free plan includes 2 tailored resumes.",
    );
  }

  if (isPending || !data) {
    return (
      <main className={styles.loading} aria-live="polite">
        <span />
        <p>Opening your secure workspace…</p>
      </main>
    );
  }

  const firstName = data.user.name?.trim().split(/\s+/)[0] || "there";
  const initials = getInitials(data.user.name);
  const unreadNotificationCount = 0;
  const uploadedResumes = resumes.filter(
    (resume) =>
      resume.importStatus === "uploaded" &&
      resume.compatibilityStatus === "supported",
  );

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link
            aria-label="Make My Resume home"
            className={styles.brand}
            href="/"
          >
            M
          </Link>

          <nav aria-label="Workspace navigation" className={styles.desktopNav}>
            <Link className={styles.activeNav} href="/dashboard">
              Dashboard
            </Link>
            <a href="#resumes">Resumes</a>
            <a href="#activity">Activity</a>
          </nav>

          <div className={styles.accountArea}>
            <span className={styles.usageBadge}>
              <i /> 0 / 2 tailored
            </span>
            <button
              aria-label="Notifications — none unread"
              className={styles.iconButton}
              data-has-unread={unreadNotificationCount > 0}
              onClick={showNotifications}
              type="button"
            >
              <Icon name="bell" />
            </button>
            <details className={styles.accountMenu}>
              <summary aria-label="Open account menu">
                <span>{initials}</span>
                <i aria-hidden="true" />
              </summary>
              <div>
                <strong>{data.user.name || "Your account"}</strong>
                <small>{data.user.email}</small>
                <button disabled={isSigningOut} onClick={signOut} type="button">
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.welcome} aria-labelledby="dashboard-title">
          <div>
            <h1 id="dashboard-title">
              {greeting}, {firstName}.
            </h1>
            <p>
              Tailor only what you can prove. Your verified workspace is ready.
            </p>
          </div>
          <div className={styles.primaryActions}>
            <button
              className={styles.primaryButton}
              onClick={() => setIsUploadOpen(true)}
              type="button"
            >
              <Icon name="upload" /> Upload resume
            </button>
            <button
              className={styles.secondaryButton}
              onClick={announceCreateFeature}
              type="button"
            >
              <Icon name="plus" /> Create
            </button>
          </div>
        </section>

        {(signOutError || featureNotice) && (
          <div
            className={signOutError ? styles.errorNotice : styles.featureNotice}
            role={signOutError ? "alert" : "status"}
          >
            <span>{signOutError || featureNotice}</span>
            {!signOutError && (
              <button
                aria-label="Dismiss notification"
                onClick={() => setFeatureNotice(null)}
                type="button"
              >
                ×
              </button>
            )}
          </div>
        )}

        <section className={styles.stats} aria-label="Workspace summary">
          <article>
            <span>Resumes</span>
            <div>
              <strong>{uploadedResumes.length}</strong>
              <small>Uploaded</small>
            </div>
          </article>
          <article>
            <span>Tailored drafts</span>
            <div>
              <strong>0</strong>
              <small>Applications</small>
            </div>
          </article>
          <article>
            <span>Current plan</span>
            <div>
              <strong>Free</strong>
              <button
                className={styles.upgradeButton}
                onClick={showUpgradeStatus}
                type="button"
              >
                Upgrade
              </button>
            </div>
          </article>
          <article>
            <span className={styles.creditLabel}>
              Credits <b>0 / 2</b>
            </span>
            <div
              className={styles.creditTrack}
              aria-label="0 of 2 credits used"
            >
              <i />
            </div>
          </article>
        </section>

        <section className={styles.resumeSection} id="resumes">
          <div className={styles.sectionHeading}>
            <div>
              <h2>Your resumes</h2>
              <span>{uploadedResumes.length} uploaded</span>
            </div>
            <small>{resumes.length} total</small>
          </div>

          {libraryError && (
            <div className={styles.libraryError} role="alert">
              <span>{libraryError}</span>
              <button onClick={() => void refreshResumes()} type="button">
                Try again
              </button>
            </div>
          )}

          {isLoadingLibrary && resumes.length === 0 ? (
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
                  Upload your existing resume. We’ll preserve the original and
                  ask you to verify every extracted detail in the next phase.
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

        <section className={styles.lowerGrid}>
          <article className={styles.activityCard} id="activity">
            <div className={styles.cardHeading}>
              <h2>Recent Activity</h2>
              <span>
                {resumes.length > 0 ? "Latest imports" : "All caught up"}
              </span>
            </div>
            {resumes.length > 0 ? (
              <ol className={styles.activityList}>
                {resumes.slice(0, 3).map((resume) => (
                  <li key={resume.importId}>
                    <i data-status={resume.importStatus} />
                    <span>
                      <strong>{resume.name}</strong>
                      {resume.compatibilityStatus ===
                      "unsupported_legacy_format"
                        ? " needs a supported replacement"
                        : resume.importStatus === "uploaded"
                          ? " uploaded securely"
                          : ` — ${importStatusLabel(resume.importStatus).toLowerCase()}`}
                    </span>
                    <small>
                      {formatUpdatedAt(resume.updatedAt).replace(
                        "Updated ",
                        "",
                      )}
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.emptyActivity}>
                <Icon name="activity" />
                <div>
                  <strong>No activity yet</strong>
                  <p>
                    Your resume imports, verifications, and tailored drafts will
                    appear here.
                  </p>
                </div>
              </div>
            )}
          </article>

          <article className={styles.trustCard}>
            <span className={styles.shieldIcon}>
              <Icon name="shield" />
            </span>
            <h2>Zero hallucination</h2>
            <p>
              We only tailor statements backed by your verified experiences.
              Never fabricated for ATS scores.
            </p>
            <Link href="/#integrity">Learn about verification →</Link>
          </article>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>© {currentYear ? `${currentYear} ` : ""}Make My Resume</span>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/#integrity">Methodology</Link>
          <a href="mailto:support@makemyresume.app">Support</a>
        </nav>
      </footer>

      <nav
        aria-label="Mobile workspace navigation"
        className={styles.mobileNav}
      >
        <Link className={styles.mobileActive} href="/dashboard">
          <Icon name="dashboard" />
          <span>Dashboard</span>
        </Link>
        <a href="#resumes">
          <Icon name="document" />
          <span>Resumes</span>
        </a>
        <a href="#activity">
          <Icon name="activity" />
          <span>Activity</span>
        </a>
        <details>
          <summary>
            <Icon name="profile" />
            <span>Profile</span>
          </summary>
          <div>
            <small>{data.user.email}</small>
            <button disabled={isSigningOut} onClick={signOut} type="button">
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </details>
      </nav>

      {isUploadOpen && (
        <ResumeUploadDialog
          onClose={() => setIsUploadOpen(false)}
          onComplete={() => void refreshResumes()}
        />
      )}
    </div>
  );
}
