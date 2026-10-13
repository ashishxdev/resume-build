// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_RESUME_PRESENTATION } from "@make-my-resume/contracts";

import { PublicResumePage } from "./public-resume-page";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  get: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ shareToken: "a".repeat(43) }),
}));

vi.mock("@/lib/resume/version-client", () => ({
  downloadPublicResumeShare: mocks.download,
  getPublicResumeShare: mocks.get,
}));

const sharedResume = {
  versionName: "Acme application",
  document: {
    name: "Alex Mercer",
    headline: "Software Engineer",
    contact: ["alex@example.com"],
    sections: [
      {
        kind: "experience",
        title: "Experience",
        items: [
          {
            id: "item_1",
            sourceClaimId: "claim_1",
            heading: "Engineer at Acme",
            body: "Built reliable APIs.",
            tailored: true,
          },
        ],
      },
    ],
  },
  presentation: DEFAULT_RESUME_PRESENTATION,
  updatedAt: "2026-10-12T08:00:00.000Z",
};

describe("PublicResumePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(sharedResume);
    mocks.download.mockResolvedValue({
      blob: new Blob(["pdf"]),
      filename: "acme-application.pdf",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the saved public version without requiring authentication", async () => {
    const { container } = render(<PublicResumePage />);

    expect(
      await screen.findByRole("heading", { name: "Acme application" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Alex Mercer" })).toBeTruthy();
    expect(screen.getByText("Built reliable APIs.")).toBeTruthy();
    expect(screen.getByText("Unlisted private link")).toBeTruthy();
    expect(
      container
        .querySelector(".professional-resume")
        ?.getAttribute("data-template"),
    ).toBe("professional");
  });

  it("downloads the shared PDF from the public endpoint", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:resume");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    render(<PublicResumePage />);
    await screen.findByRole("heading", { name: "Acme application" });

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith("a".repeat(43)),
    );
  });

  it("shows a neutral unavailable state for disabled or unknown links", async () => {
    mocks.get.mockRejectedValue(new Error("not found"));
    render(<PublicResumePage />);

    expect(
      await screen.findByRole("heading", {
        name: "This resume is no longer shared.",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/disabled or regenerated/i)).toBeTruthy();
    expect(screen.queryByText("not found")).toBeNull();
  });
});
