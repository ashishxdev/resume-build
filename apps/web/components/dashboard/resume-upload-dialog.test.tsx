// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeUploadDialog } from "./resume-upload-dialog";

const mocks = vi.hoisted(() => ({
  cancelResumeImport: vi.fn(),
  completeResumeImport: vi.fn(),
  createResumeImport: vi.fn(),
  uploadResumeObject: vi.fn(),
}));

vi.mock("@/lib/resume/import-client", () => ({
  ResumeImportApiError: class ResumeImportApiError extends Error {},
  cancelResumeImport: mocks.cancelResumeImport,
  completeResumeImport: mocks.completeResumeImport,
  createResumeImport: mocks.createResumeImport,
  uploadResumeObject: mocks.uploadResumeObject,
  validateResumeFile: (file: File) => ({
    data: {
      fileName: file.name,
      mimeType: "application/pdf",
      size: file.size,
      sourceType: "pdf",
    },
  }),
}));

describe("ResumeUploadDialog", () => {
  beforeEach(() => {
    mocks.cancelResumeImport.mockReset().mockResolvedValue(undefined);
    mocks.completeResumeImport
      .mockReset()
      .mockResolvedValue({ status: "uploaded" });
    mocks.createResumeImport.mockReset().mockResolvedValue({
      importId: "import_1",
      uploadUrl: "https://storage.example/upload",
    });
    mocks.uploadResumeObject
      .mockReset()
      .mockImplementation(
        (
          _url: string,
          _type: string,
          _file: File,
          onProgress: (value: number) => void,
        ) => {
          onProgress(100);
          return { abort: vi.fn(), promise: Promise.resolve() };
        },
      );
  });

  afterEach(() => cleanup());

  it("uploads, verifies, and reports completion", async () => {
    const onComplete = vi.fn();
    render(<ResumeUploadDialog onClose={vi.fn()} onComplete={onComplete} />);
    const file = new File(["%PDF-test"], "alex-resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    await waitFor(() =>
      expect(screen.getByText("Upload complete")).toBeTruthy(),
    );
    expect(mocks.createResumeImport).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "alex-resume.pdf",
        sourceType: "pdf",
      }),
    );
    expect(mocks.uploadResumeObject).toHaveBeenCalled();
    expect(mocks.completeResumeImport).toHaveBeenCalledWith("import_1");
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("keeps a failed file selected so the user can retry", async () => {
    mocks.createResumeImport.mockRejectedValueOnce(new Error("offline"));
    render(<ResumeUploadDialog onClose={vi.fn()} onComplete={vi.fn()} />);
    const file = new File(["%PDF-test"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy(),
    );
    expect(screen.getByText("resume.pdf")).toBeTruthy();
  });

  it("cancels the server import when an error dialog is dismissed", async () => {
    const onClose = vi.fn();
    mocks.completeResumeImport.mockRejectedValueOnce(new Error("offline"));
    render(<ResumeUploadDialog onClose={onClose} onComplete={vi.fn()} />);
    const file = new File(["%PDF-test"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close resume upload" }),
    );

    await waitFor(() =>
      expect(mocks.cancelResumeImport).toHaveBeenCalledWith("import_1"),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open when server cleanup cannot be confirmed", async () => {
    const onClose = vi.fn();
    mocks.completeResumeImport.mockRejectedValueOnce(new Error("offline"));
    mocks.cancelResumeImport.mockRejectedValueOnce(new Error("offline"));
    render(<ResumeUploadDialog onClose={onClose} onComplete={vi.fn()} />);
    const file = new File(["%PDF-test"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close resume upload" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "We could not cancel this import. Please try again before closing.",
        ),
      ).toBeTruthy(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
