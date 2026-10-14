"use client";

import { useState } from "react";

import {
  createResumeVersionShare,
  getResumeVersionShare,
  listResumeVersions,
  setResumeVersionShareEnabled,
} from "@/lib/resume/version-client";

import styles from "./private-resume-share-button.module.css";

function LinkIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M10.5 13.5 13.5 10.5" />
      <path d="m7.4 15.6-1.5 1.5a3.68 3.68 0 0 1-5.2-5.2l3-3a3.68 3.68 0 0 1 5.2 0" />
      <path d="m16.6 8.4 1.5-1.5a3.68 3.68 0 0 1 5.2 5.2l-3 3a3.68 3.68 0 0 1-5.2 0" />
    </svg>
  );
}

interface PrivateResumeShareButtonProps {
  compact?: boolean;
  resumeId: string;
  resumeName?: string;
  versionId?: string;
}

export function PrivateResumeShareButton({
  compact = false,
  resumeId,
  resumeName,
  versionId,
}: PrivateResumeShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    if (busy) return;
    setBusy(true);
    setCopied(false);
    setManualUrl(null);
    setError(null);

    try {
      let resolvedVersionId = versionId;
      if (!resolvedVersionId) {
        const history = await listResumeVersions(resumeId);
        resolvedVersionId =
          history.activeVersionId ??
          history.versions.find((version) => version.type === "base")?.id ??
          history.versions[0]?.id;
      }
      if (!resolvedVersionId) {
        throw new Error("Verify this resume before creating a private link.");
      }

      let record = await getResumeVersionShare(resumeId, resolvedVersionId);
      record ??= await createResumeVersionShare(resumeId, resolvedVersionId);
      if (!record.enabled) {
        record = await setResumeVersionShareEnabled(
          resumeId,
          resolvedVersionId,
          true,
        );
      }

      const url = `${window.location.origin}/r/${record.token}`;
      if (!navigator.clipboard?.writeText) {
        setManualUrl(url);
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        setManualUrl(url);
        setError(
          "Clipboard access was blocked. Copy the private link manually below.",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The private link could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  const accessibleName = resumeName
    ? `Share ${resumeName} privately`
    : "Share this resume privately";

  return (
    <div className={styles.action} data-compact={compact}>
      <button
        aria-label={accessibleName}
        disabled={busy}
        onClick={() => void share()}
        title={compact ? accessibleName : undefined}
        type="button"
      >
        <LinkIcon />
        <span>
          {busy ? "Creating link…" : copied ? "Link copied" : "Share link"}
        </span>
      </button>
      {copied && (
        <small className={styles.success} role="status">
          Private link copied
        </small>
      )}
      {manualUrl && (
        <label className={styles.manualLink}>
          Copy private link
          <input
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={manualUrl}
          />
        </label>
      )}
      {error && (
        <small className={styles.error} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
