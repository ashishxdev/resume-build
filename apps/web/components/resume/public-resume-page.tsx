"use client";

import type { PublicResumeShare } from "@make-my-resume/contracts";
import { ProfessionalResume } from "@make-my-resume/resume-renderer";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SiteBrand } from "@/components/home/site-brand";
import {
  downloadPublicResumeShare,
  getPublicResumeShare,
} from "@/lib/resume/version-client";

import styles from "./public-resume-page.module.css";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PublicResumePage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [record, setRecord] = useState<PublicResumeShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPublicResumeShare(shareToken)
      .then((next) => {
        if (!cancelled) setRecord(next);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const exported = await downloadPublicResumeShare(shareToken);
      const url = URL.createObjectURL(exported.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      anchor.hidden = true;
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setError(
        "This download is no longer available. Ask the owner for a new link.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.centerState} aria-live="polite">
        <span aria-hidden="true" />
        <p>Opening the private resume…</p>
      </main>
    );
  }

  if (unavailable || !record) {
    return (
      <main className={styles.unavailable}>
        <SiteBrand />
        <div aria-hidden="true">×</div>
        <span>Private link unavailable</span>
        <h1>This resume is no longer shared.</h1>
        <p>
          The owner may have disabled or regenerated this private link. Ask them
          for a new URL if you still need access.
        </p>
        <Link href="/">Visit Make My Resume</Link>
      </main>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SiteBrand />
        <span>
          <i aria-hidden="true" />
          Unlisted private link
        </span>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <div>
            <span>Shared resume</span>
            <h1>{record.versionName}</h1>
            <p>
              This saved version was shared privately. The original uploaded
              document and account details remain protected.
            </p>
          </div>
          <div className={styles.actions}>
            <small>Updated {dateLabel(record.updatedAt)}</small>
            <button
              disabled={downloading}
              onClick={() => void download()}
              type="button"
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </section>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.paperStage} aria-label="Shared resume">
          <ProfessionalResume
            document={record.document}
            presentation={record.presentation}
          />
        </section>

        <aside className={styles.privacyNote}>
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Shared with the owner’s permission</strong>
            <p>
              This page is unlisted, excluded from search indexing, and can be
              disabled by the owner at any time.
            </p>
          </div>
        </aside>
      </main>

      <footer className={styles.footer}>
        <span>Created with Make My Resume</span>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
