import {
  MAX_RESUME_FILE_SIZE,
  type ResumeMimeType,
} from "@make-my-resume/contracts";
import JSZip from "jszip";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export const documentExtractionLimits = {
  maximumCompressedBytes: MAX_RESUME_FILE_SIZE,
  maximumDocxEntries: 2_000,
  maximumDocxUncompressedBytes: 50 * 1024 * 1024,
  maximumExtractedCharacters: 250_000,
  maximumPdfPages: 100,
  maximumParsingMilliseconds: 15_000,
} as const;

export class DocumentExtractionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionLimitError";
  }
}

function assertWithinDeadline(deadline: number) {
  if (Date.now() >= deadline) {
    throw new DocumentExtractionLimitError(
      "The document took too long to parse safely.",
    );
  }
}

async function beforeDeadline<T>(promise: Promise<T>, deadline: number) {
  const remaining = deadline - Date.now();
  assertWithinDeadline(deadline);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new DocumentExtractionLimitError(
                "The document took too long to parse safely.",
              ),
            ),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertCharacterLimit(characterCount: number) {
  if (characterCount > documentExtractionLimits.maximumExtractedCharacters) {
    throw new DocumentExtractionLimitError(
      "The document contains too much text to parse safely.",
    );
  }
}

export function assertPdfPageLimit(pageCount: number) {
  if (pageCount > documentExtractionLimits.maximumPdfPages) {
    throw new DocumentExtractionLimitError(
      `PDFs may contain at most ${documentExtractionLimits.maximumPdfPages} pages.`,
    );
  }
}

export function assertDocxArchiveLimits(
  entries: Array<{ uncompressedSize: number }>,
) {
  if (entries.length > documentExtractionLimits.maximumDocxEntries) {
    throw new DocumentExtractionLimitError(
      "The DOCX contains too many archive entries to parse safely.",
    );
  }
  let uncompressedBytes = 0;
  for (const entry of entries) {
    if (
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.uncompressedSize < 0
    ) {
      throw new DocumentExtractionLimitError(
        "The DOCX archive size could not be verified safely.",
      );
    }
    uncompressedBytes += entry.uncompressedSize;
    if (
      uncompressedBytes > documentExtractionLimits.maximumDocxUncompressedBytes
    ) {
      throw new DocumentExtractionLimitError(
        "The expanded DOCX is too large to parse safely.",
      );
    }
  }
}

export function createDocxDocumentPage(text: string): ExtractedPage[] {
  const normalized = text.trim();
  assertCharacterLimit(normalized.length);
  return normalized ? [{ pageNumber: 1, text: normalized }] : [];
}

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

async function assertSafeDocxArchive(bytes: Uint8Array, deadline: number) {
  const archive = await beforeDeadline(JSZip.loadAsync(bytes), deadline);
  const entries = Object.values(archive.files);
  assertDocxArchiveLimits(
    entries.map((entry) => {
      const metadata = entry as typeof entry & {
        _data?: { uncompressedSize?: number };
      };
      return {
        uncompressedSize: entry.dir
          ? 0
          : (metadata._data?.uncompressedSize ?? NaN),
      };
    }),
  );
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: ResumeMimeType,
): Promise<ExtractedPage[]> {
  if (bytes.byteLength > documentExtractionLimits.maximumCompressedBytes) {
    throw new DocumentExtractionLimitError(
      "The document exceeds the 10 MB upload limit.",
    );
  }
  const deadline =
    Date.now() + documentExtractionLimits.maximumParsingMilliseconds;

  if (mimeType === "application/pdf") {
    const loadingTask = getDocument({ data: bytes });
    let document;
    try {
      document = await beforeDeadline(loadingTask.promise, deadline);
    } catch (error) {
      await loadingTask.destroy();
      throw error;
    }
    const pages: ExtractedPage[] = [];
    let extractedCharacters = 0;
    try {
      assertPdfPageLimit(document.numPages);
      for (
        let pageNumber = 1;
        pageNumber <= document.numPages;
        pageNumber += 1
      ) {
        assertWithinDeadline(deadline);
        const page = await beforeDeadline(
          document.getPage(pageNumber),
          deadline,
        );
        const content = await beforeDeadline(page.getTextContent(), deadline);
        const text = joinPdfTextItems(content.items);
        extractedCharacters += text.length;
        assertCharacterLimit(extractedCharacters);
        if (text) pages.push({ pageNumber, text });
      }
    } finally {
      await loadingTask.destroy();
    }
    return pages;
  }

  await assertSafeDocxArchive(bytes, deadline);
  const result = await beforeDeadline(
    mammoth.extractRawText({ buffer: Buffer.from(bytes) }),
    deadline,
  );
  return createDocxDocumentPage(result.value);
}
