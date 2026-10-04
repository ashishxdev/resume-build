"use client";

import type {
  ResumeExportFormat,
  ResumeTemplateDensity,
  TailoringSession,
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
  downloadTailoredResume,
  getTailoringSession,
} from "@/lib/tailoring/client";

export function ResumeDocumentPage() {
  const { tailoringSessionId } = useParams<{ tailoringSessionId: string }>();
  const router = useRouter();
  const { data: authSession, isPending } = authClient.useSession();
  const [session, setSession] = useState<TailoringSession | null>(null);
  const [density, setDensity] = useState<ResumeTemplateDensity>("comfortable");
  const [downloading, setDownloading] = useState<ResumeExportFormat | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !authSession)
      router.replace(
        `/login?redirect=${encodeURIComponent(`/tailoring/${tailoringSessionId}/resume`)}`,
      );
  }, [authSession, isPending, router, tailoringSessionId]);

  useEffect(() => {
    if (!authSession) return;
    let cancelled = false;
    void getTailoringSession(tailoringSessionId)
      .then((record) => {
        if (!cancelled) setSession(record);
      })
      .catch((requestError: unknown) => {
        if (!cancelled)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "We could not load this resume version.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authSession, tailoringSessionId]);

  const document = useMemo(() => {
    if (!session?.finalClaims) return null;
    return buildProfessionalResumeDocument(session.finalClaims, {
      tailoredClaimIds: session.suggestions
        .filter((suggestion) => suggestion.status === "accepted")
        .map((suggestion) => suggestion.sourceClaimId),
    });
  }, [session]);

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
          <p>Preparing your resume preview…</p>
        </main>
      </WorkspaceShell>
    );
  }

  if (
    !session ||
    session.status !== "completed" ||
    !session.tailoredVersionId ||
    !document
  ) {
    return (
      <WorkspaceShell>
        <main className={styles.centerState}>
          <span className={styles.failureIcon}>!</span>
          <h1>This resume is not ready to export.</h1>
          <p>{error ?? "Complete every tailoring decision first."}</p>
          <Link href={`/tailoring/${tailoringSessionId}`}>
            Return to tailoring
          </Link>
        </main>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <main className={styles.documentPage}>
        <div className={styles.documentBreadcrumbs}>
          <Link href={`/tailoring/${session.id}`}>← Tailored version</Link>
          <span>Professional ATS template</span>
        </div>

        <section className={styles.documentHero}>
          <div>
            <span className={styles.eyebrow}>Export studio</span>
            <h1>Your polished resume is ready.</h1>
            <p>
              Preview the final structure, choose a spacing style, and download
              a searchable PDF or an editable Word document.
            </p>
          </div>
          <div className={styles.versionBadge}>
            <strong>Original protected</strong>
            <span>This is a separate tailored version.</span>
          </div>
        </section>

        <div className={styles.documentWorkspace}>
          <aside className={styles.exportControls}>
            <div>
              <span className={styles.eyebrow}>Template</span>
              <h2>Professional ATS</h2>
              <p>
                A restrained single-column layout designed for readability and
                reliable text extraction.
              </p>
            </div>

            <fieldset>
              <legend>Section spacing</legend>
              <label>
                <input
                  checked={density === "comfortable"}
                  name="density"
                  onChange={() => setDensity("comfortable")}
                  type="radio"
                />
                <span>
                  <strong>Comfortable</strong>
                  <small>More breathing room</small>
                </span>
              </label>
              <label>
                <input
                  checked={density === "compact"}
                  name="density"
                  onChange={() => setDensity("compact")}
                  type="radio"
                />
                <span>
                  <strong>Compact</strong>
                  <small>Fits longer resumes</small>
                </span>
              </label>
            </fieldset>

            <div className={styles.exportActions}>
              <button
                disabled={downloading !== null}
                onClick={() => void download("pdf")}
              >
                {downloading === "pdf" ? "Creating PDF…" : "Download PDF"}
              </button>
              <button
                disabled={downloading !== null}
                onClick={() => void download("docx")}
              >
                {downloading === "docx"
                  ? "Creating DOCX…"
                  : "Download editable DOCX"}
              </button>
            </div>
            <p className={styles.exportPrivacy}>
              Downloads are generated privately from version{" "}
              {session.tailoredVersionId}.
            </p>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
          </aside>

          <section className={styles.paperStage} aria-label="Resume preview">
            <ProfessionalResume document={document} density={density} />
          </section>
        </div>
      </main>
    </WorkspaceShell>
  );
}
