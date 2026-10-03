"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

import {
  cancelResumeImport,
  completeResumeImport,
  createResumeImport,
  ResumeImportApiError,
  uploadResumeObject,
  validateResumeFile,
} from "@/lib/resume/import-client";

import styles from "@/app/dashboard/dashboard.module.css";

type UploadStage =
  "selecting" | "uploading" | "verifying" | "success" | "error";

interface ResumeUploadDialogProps {
  onClose: () => void;
  onComplete: () => void;
}

function readableSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ResumeUploadDialog({
  onClose,
  onComplete,
}: ResumeUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeUpload = useRef<{ abort: () => void } | null>(null);
  const activeImportId = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("selecting");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      activeUpload.current?.abort();
      const importId = activeImportId.current;
      if (importId) void cancelResumeImport(importId).catch(() => {});
    };
  }, []);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    const validation = validateResumeFile(nextFile);
    if (validation.error) {
      setFile(null);
      setError(validation.error);
      return;
    }
    setFile(nextFile);
    setError(null);
    setStage("selecting");
    setProgress(0);
  }

  async function cleanupImport() {
    const importId = activeImportId.current;
    if (importId) {
      await cancelResumeImport(importId);
      if (activeImportId.current === importId) activeImportId.current = null;
    }
  }

  async function startUpload() {
    if (!file) return;
    const validation = validateResumeFile(file);
    if (!validation.data) {
      setError(validation.error);
      return;
    }

    const uploadInput = validation.data;

    setError(null);
    setProgress(0);
    setStage("uploading");

    try {
      await cleanupImport();
      const uploadSession = await createResumeImport(uploadInput);
      activeImportId.current = uploadSession.importId;
      const upload = uploadResumeObject(
        uploadSession.uploadUrl,
        uploadInput.mimeType,
        file,
        setProgress,
      );
      activeUpload.current = upload;
      await upload.promise;
      activeUpload.current = null;
      setStage("verifying");
      await completeResumeImport(uploadSession.importId);
      activeImportId.current = null;
      setStage("success");
      onComplete();
    } catch (caught) {
      activeUpload.current = null;
      if (caught instanceof DOMException && caught.name === "AbortError")
        return;
      setError(
        caught instanceof ResumeImportApiError
          ? caught.message
          : "The resume could not be uploaded. Please try again.",
      );
      setStage("error");
    }
  }

  async function cancel() {
    activeUpload.current?.abort();
    activeUpload.current = null;
    try {
      await cleanupImport();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ResumeImportApiError
          ? caught.message
          : "We could not cancel this import. Please try again before closing.",
      );
      setStage("error");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  const busy = stage === "uploading" || stage === "verifying";

  return (
    <div
      aria-labelledby="resume-upload-title"
      aria-modal="true"
      className={styles.dialogBackdrop}
      role="dialog"
    >
      <section className={styles.uploadDialog}>
        <button
          aria-label="Close resume upload"
          className={styles.dialogClose}
          disabled={busy}
          onClick={() => void cancel()}
          type="button"
        >
          ×
        </button>

        {stage === "success" ? (
          <div className={styles.uploadSuccess}>
            <span aria-hidden="true">✓</span>
            <p>Upload complete</p>
            <h2 id="resume-upload-title">Your original resume is preserved.</h2>
            <p>
              {file?.name} is being extracted. You can review every detail from
              your resume library.
            </p>
            <button
              className={styles.primaryButton}
              onClick={onClose}
              type="button"
            >
              View resume library
            </button>
          </div>
        ) : (
          <>
            <span className={styles.dialogEyebrow}>Resume import</span>
            <h2 id="resume-upload-title">Add a verified baseline</h2>
            <p className={styles.dialogIntro}>
              Upload the resume you already trust. We preserve the original
              before any extraction or tailoring begins.
            </p>

            <div
              className={styles.dropZone}
              data-dragging={isDragging}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={busy}
                onChange={(event) => chooseFile(event.target.files?.[0])}
                ref={inputRef}
                type="file"
              />
              {file ? (
                <div className={styles.selectedFile}>
                  <span aria-hidden="true">DOC</span>
                  <div>
                    <strong>{file.name}</strong>
                    <small>{readableSize(file.size)}</small>
                  </div>
                  {!busy && (
                    <button
                      onClick={() => inputRef.current?.click()}
                      type="button"
                    >
                      Replace
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => inputRef.current?.click()} type="button">
                  <span aria-hidden="true">↑</span>
                  <strong>Drop your resume here</strong>
                  <small>or choose a file</small>
                </button>
              )}
            </div>

            <div className={styles.fileRules}>
              <span>PDF or DOCX only · images are not accepted</span>
              <span>10 MB maximum</span>
            </div>

            {(busy || progress > 0) && (
              <div className={styles.uploadProgress} aria-live="polite">
                <div>
                  <span>
                    {stage === "verifying"
                      ? "Verifying file integrity…"
                      : `Uploading securely… ${progress}%`}
                  </span>
                  <b>{stage === "verifying" ? "Checking" : `${progress}%`}</b>
                </div>
                <i>
                  <span
                    style={{
                      width: stage === "verifying" ? "100%" : `${progress}%`,
                    }}
                  />
                </i>
              </div>
            )}

            {error && (
              <p className={styles.uploadError} role="alert">
                {error}
              </p>
            )}

            <div className={styles.dialogActions}>
              <button
                className={styles.secondaryButton}
                onClick={cancel}
                type="button"
              >
                {busy ? "Cancel upload" : "Cancel"}
              </button>
              <button
                className={styles.primaryButton}
                disabled={!file || busy}
                onClick={startUpload}
                type="button"
              >
                {stage === "error" ? "Try again" : "Upload resume"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
