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
  maximumPdfAnnotationsPerPage: 200,
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

interface PdfLinkAnnotation {
  subtype?: unknown;
  url?: unknown;
  rect?: unknown;
}

interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>;
  getAnnotations(): Promise<unknown[]>;
}

function isPdfPage(value: unknown): value is PdfPage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.getTextContent === "function" &&
    typeof candidate.getAnnotations === "function"
  );
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

function safeDocumentLink(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function textOverlapsAnnotation(item: PdfTextItem, rect: number[]) {
  const [firstX, firstY, secondX, secondY] = rect;
  if (
    firstX === undefined ||
    firstY === undefined ||
    secondX === undefined ||
    secondY === undefined
  ) {
    return false;
  }
  const left = Math.min(firstX, secondX);
  const right = Math.max(firstX, secondX);
  const bottom = Math.min(firstY, secondY);
  const top = Math.max(firstY, secondY);
  const x = item.transform[4] ?? 0;
  const baseline = item.transform[5] ?? 0;
  const itemRight = x + item.width;
  const itemBottom = baseline - Math.max(2, item.height * 0.35);
  const itemTop = baseline + Math.max(2, item.height);
  return (
    itemRight >= left - 1 &&
    x <= right + 1 &&
    itemTop >= bottom - 1 &&
    itemBottom <= top + 1
  );
}

export function attachPdfLinksToTextItems(
  items: unknown[],
  annotations: unknown[],
) {
  const linkedItems = items.map((item) =>
    isPdfTextItem(item) ? { ...item, transform: [...item.transform] } : item,
  );
  const textItems = linkedItems
    .map((item, index) => ({ item, index }))
    .filter((entry): entry is { item: PdfTextItem; index: number } =>
      isPdfTextItem(entry.item),
    );

  for (const value of annotations.slice(
    0,
    documentExtractionLimits.maximumPdfAnnotationsPerPage,
  )) {
    if (!value || typeof value !== "object") continue;
    const annotation = value as PdfLinkAnnotation;
    const url = safeDocumentLink(annotation.url);
    if (
      annotation.subtype !== "Link" ||
      !url ||
      !Array.isArray(annotation.rect) ||
      !annotation.rect.every((coordinate) => typeof coordinate === "number")
    ) {
      continue;
    }
    const overlapping = textItems.filter(({ item }) =>
      textOverlapsAnnotation(item, annotation.rect as number[]),
    );
    if (!overlapping.length) continue;
    const anchor = overlapping.map(({ item }) => item.str).join(" ");
    if (anchor.includes(url)) continue;
    const preservesUsefulLink =
      /\bLive\b/i.test(anchor) ||
      /\b(?:LinkedIn|GitHub|Portfolio|Website|Site)\b/i.test(anchor);
    if (!preservesUsefulLink) continue;
    const last = overlapping.at(-1);
    if (!last) continue;
    linkedItems[last.index] = {
      ...last.item,
      str: `${last.item.str} (${url})`,
    };
  }

  return linkedItems;
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

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (_match, decimal: string, hexadecimal: string, name: string) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal)
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return named[name.toLocaleLowerCase("en")] ?? _match;
    },
  );
}

export function docxHtmlToLinkedText(html: string) {
  const linked = html.replace(
    /<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, doubleQuoted: string, singleQuoted: string, labelHtml: string) => {
      const label = decodeHtmlEntities(labelHtml.replace(/<[^>]+>/g, ""));
      const url = safeDocumentLink(
        decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? ""),
      );
      if (!url) return label;
      return label.trim() === url ? url : `${label} (${url})`;
    },
  );
  return decodeHtmlEntities(
    linked
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/(?:p|div|h[1-6]|li|ul|ol|table|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
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
        const page = await beforeDeadline<unknown>(
          document.getPage(pageNumber) as Promise<unknown>,
          deadline,
        );
        if (!isPdfPage(page)) {
          throw new DocumentExtractionLimitError(
            "The PDF page could not be parsed safely.",
          );
        }
        const [content, annotations] = await beforeDeadline(
          Promise.all([page.getTextContent(), page.getAnnotations()]),
          deadline,
        );
        const text = joinPdfTextItems(
          attachPdfLinksToTextItems(content.items, annotations),
        );
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
    mammoth.convertToHtml({ buffer: Buffer.from(bytes) }),
    deadline,
  );
  return createDocxDocumentPage(docxHtmlToLinkedText(result.value));
}
