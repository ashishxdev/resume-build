import { describe, expect, it, vi } from "vitest";

import {
  createGeminiResumeParser,
  parseGroundedGeminiClaims,
} from "./gemini-resume-parser.js";
import { createDocxDocumentPage } from "../../modules/resumes/document-text-extractor.js";

const pages = [
  {
    pageNumber: 1,
    text: `Alex Mercer
Product designer focused on ethical career tools.
Experience
Senior Product Designer — Acme — 2022–Present
Led a cross-functional design system used by four product teams.
Skills
Figma, research, design systems`,
  },
];

describe("parseGroundedGeminiClaims", () => {
  it("accepts grouped claims only when their exact evidence exists", () => {
    const claims = parseGroundedGeminiClaims(
      JSON.stringify({
        claims: [
          {
            category: "summary",
            label: "Professional summary",
            value: "Product designer focused on ethical career tools.",
            source: {
              pageNumber: 1,
              quote: "Product designer focused on ethical career tools.",
            },
          },
          {
            category: "experience",
            label: "Senior Product Designer at Acme",
            value:
              "Senior Product Designer — Acme — 2022–Present\nLed a cross-functional design system used by four product teams.",
            source: {
              pageNumber: 1,
              quote:
                "Senior Product Designer — Acme — 2022–Present Led a cross-functional design system used by four product teams.",
            },
          },
          {
            category: "experience",
            label: "Invented role",
            value: "Increased revenue by 900%.",
            source: { pageNumber: 1, quote: "Increased revenue by 900%." },
          },
        ],
      }),
      pages,
    );

    expect(claims).toHaveLength(2);
    expect(claims.map((claim) => claim.category)).toEqual([
      "summary",
      "experience",
    ]);
    expect(claims[1]).toMatchObject({
      pageNumber: 1,
      sourceText:
        "Senior Product Designer — Acme — 2022–Present Led a cross-functional design system used by four product teams.",
      status: "unreviewed",
      userAdded: false,
      order: 1,
    });
  });

  it("deduplicates claims and keeps at most one summary", () => {
    const output = {
      claims: [
        {
          category: "summary",
          label: "Summary",
          value: "Product designer focused on ethical career tools.",
          source: {
            pageNumber: 1,
            quote: "Product designer focused on ethical career tools.",
          },
        },
        {
          category: "summary",
          label: "About",
          value: "Another summary",
          source: { pageNumber: 1, quote: "Alex Mercer" },
        },
        {
          category: "skills",
          label: "Skills",
          value: "Figma, research, design systems",
          source: { pageNumber: 1, quote: "Figma, research, design systems" },
        },
        {
          category: "skills",
          label: "Core skills",
          value: "Figma, research, design systems",
          source: { pageNumber: 1, quote: "Figma, research, design systems" },
        },
      ],
    };

    expect(
      parseGroundedGeminiClaims(JSON.stringify(output), pages),
    ).toHaveLength(2);
  });

  it("grounds Gemini claims against the synthetic DOCX page", () => {
    const docxPages = createDocxDocumentPage(
      "Experience\nSenior Product Designer at Acme",
    );
    const claims = parseGroundedGeminiClaims(
      JSON.stringify({
        claims: [
          {
            category: "experience",
            label: "Senior Product Designer at Acme",
            value: "Senior Product Designer at Acme",
            source: {
              pageNumber: 1,
              quote: "Senior Product Designer at Acme",
            },
          },
        ],
      }),
      docxPages,
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ pageNumber: 1 });
  });
});

describe("createGeminiResumeParser", () => {
  it("requests private structured output and returns grounded claims", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        claims: [
          {
            category: "skills",
            label: "Skills",
            value: "Figma, research, design systems",
            source: {
              pageNumber: 1,
              quote: "Figma, research, design systems",
            },
          },
        ],
      }),
    });
    const parser = createGeminiResumeParser({
      apiKey: "test-key",
      model: "gemini-test-model",
      client: { interactions: { create } },
    });

    const result = await parser.parse(pages);

    expect(result).toMatchObject({
      provider: "gemini",
      model: "gemini-test-model",
      promptVersion: "resume-structure-v1",
    });
    expect(result.claims).toHaveLength(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-test-model",
        store: false,
        response_format: expect.objectContaining({
          type: "text",
          mime_type: "application/json",
        }),
      }),
      { timeout: 45_000, maxRetries: 1 },
    );
  });

  it("rejects a response with no grounded claims", async () => {
    const parser = createGeminiResumeParser({
      apiKey: "test-key",
      model: "gemini-test-model",
      client: {
        interactions: {
          create: vi.fn().mockResolvedValue({
            output_text: JSON.stringify({
              claims: [
                {
                  category: "experience",
                  label: "Invented",
                  value: "Invented result",
                  source: { pageNumber: 9, quote: "Not in the resume" },
                },
              ],
            }),
          }),
        },
      },
    });

    await expect(parser.parse(pages)).rejects.toThrow("AI_UNGROUNDED_RESPONSE");
  });
});
