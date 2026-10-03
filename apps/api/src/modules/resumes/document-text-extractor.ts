import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { ResumeMimeType } from "@make-my-resume/contracts";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export function createDocxDocumentPage(text: string): ExtractedPage[] {
  const normalized = text.trim();
  return capPages(normalized ? [{ pageNumber: 1, text: normalized }] : []);
}

const maximumExtractedCharacters = 250_000;

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
  width: number;
  height: number;
  transform: number[];
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<PdfTextItem>;
  return (
    typeof candidate.str === "string" &&
    typeof candidate.hasEOL === "boolean" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    Array.isArray(candidate.transform)
  );
}

export function joinPdfTextItems(items: unknown[]) {
  let text = "";
  let previous: PdfTextItem | null = null;

  for (const item of items) {
    if (!isPdfTextItem(item)) continue;
    if (!item.str) {
      if (item.hasEOL && text && !text.endsWith("\n")) text += "\n";
      if (item.hasEOL) previous = null;
      continue;
    }

    if (previous) {
      const previousY = previous.transform[5] ?? 0;
      const currentY = item.transform[5] ?? 0;
      const lineTolerance = Math.max(
        2,
        Math.min(previous.height || 0, item.height || 0) * 0.5,
      );
      const isNewLine = Math.abs(previousY - currentY) > lineTolerance;
      const previousX = previous.transform[4] ?? 0;
      const currentX = item.transform[4] ?? previousX;
      const gap = currentX - (previousX + previous.width);
      const wordGap = Math.max(
        1.5,
        Math.min(previous.height || 0, item.height || 0) * 0.15,
      );

      const wrappedToLineStart = currentX + wordGap < previousX;

      if (previous.hasEOL || isNewLine || wrappedToLineStart) {
        if (!text.endsWith("\n")) text += "\n";
      } else if (gap > wordGap && !/\s$/.test(text) && !/^\s/.test(item.str)) {
        text += " ";
      }
    }

    text += item.str;
    previous = item;
  }

  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function capPages(pages: ExtractedPage[]) {
  let remaining = maximumExtractedCharacters;
  return pages.flatMap((page) => {
    if (remaining <= 0) return [];
    const text = page.text.slice(0, remaining).trim();
    remaining -= text.length;
    return text ? [{ ...page, text }] : [];
  });
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: ResumeMimeType,
): Promise<ExtractedPage[]> {
  if (mimeType === "application/pdf") {
    const document = await getDocument({ data: bytes }).promise;
    const pages: ExtractedPage[] = [];
    try {
      for (
        let pageNumber = 1;
        pageNumber <= document.numPages;
        pageNumber += 1
      ) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = joinPdfTextItems(content.items);
        if (text) pages.push({ pageNumber, text });
      }
    } finally {
      await document.cleanup();
    }
    return capPages(pages);
  }

  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return createDocxDocumentPage(result.value);
}
