import type {
  ProfessionalResumeDocument,
  ResumeDocumentItem,
  ResumeTemplateDensity,
} from "@make-my-resume/contracts";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  TextItem,
  TextMarkedContent,
} from "pdfjs-dist/types/src/display/api.js";
import PDFDocument from "pdfkit";

export interface ResumeExportResult {
  bytes: Buffer;
  contentType: string;
  extension: "pdf" | "docx";
}

function bodyLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pdfBuffer(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

function ensurePdfSpace(document: PDFKit.PDFDocument, points: number) {
  const bottom = document.page.height - document.page.margins.bottom;
  if (document.y + points > bottom) document.addPage();
}

function pdfLinkTarget(value: string) {
  const trimmed = value.trim();
  if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  if (/^\+?[\d ().-]{8,}$/.test(trimmed)) {
    const number = trimmed.replace(/[^\d+]/g, "");
    return `tel:${number}`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (
    /^(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[^\s]*)?$/i.test(trimmed)
  ) {
    return `https://${trimmed}`;
  }
  return null;
}

const inlineLinkPattern =
  /(?:https?:\/\/|www\.)[^\s|,;]+|(?:linkedin\.com|github\.com)\/[^\s|,;]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi;

function pdfTextFragments(value: string, liveLink: string | null = null) {
  const fragments: Array<{ text: string; link: string | null }> = [];
  let cursor = 0;
  const pattern = liveLink
    ? /(?:https?:\/\/|www\.)[^\s|,;]+|(?:linkedin\.com|github\.com)\/[^\s|,;]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\bLive\b/gi
    : inlineLinkPattern;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? cursor;
    if (index > cursor)
      fragments.push({ text: value.slice(cursor, index), link: null });
    const raw = match[0];
    const linkedText = raw.replace(/[.)]+$/, "");
    fragments.push({
      text: linkedText,
      link:
        liveLink && linkedText.toLocaleLowerCase("en") === "live"
          ? liveLink
          : pdfLinkTarget(linkedText),
    });
    if (linkedText.length < raw.length)
      fragments.push({ text: raw.slice(linkedText.length), link: null });
    cursor = index + raw.length;
  }
  if (cursor < value.length)
    fragments.push({ text: value.slice(cursor), link: null });
  return fragments.length ? fragments : [{ text: value, link: null }];
}

function renderPdfLinkedLine(
  document: PDFKit.PDFDocument,
  value: string,
  options: PDFKit.Mixins.TextOptions,
  liveLink: string | null = null,
) {
  const fragments = pdfTextFragments(value, liveLink);
  fragments.forEach((fragment, index) => {
    document.text(fragment.text, {
      ...options,
      continued: index < fragments.length - 1,
      ...(fragment.link ? { link: fragment.link } : {}),
    });
  });
}

function projectLiveLink(item: ResumeDocumentItem) {
  const content = [item.heading, item.body].filter(Boolean).join("\n");
  const match = content.match(
    /(?:https?:\/\/|www\.)[^\s|,;]+|(?:linkedin\.com|github\.com)\/[^\s|,;]+/i,
  );
  if (!match) return null;
  return pdfLinkTarget(match[0].replace(/[.)]+$/, ""));
}

function isPdfTextItem(value: TextItem | TextMarkedContent): value is TextItem {
  return "str" in value;
}

function textOverlapsLink(item: TextItem, rect: number[]) {
  const [left, bottom, right, top] = rect;
  const x = item.transform[4];
  const baseline = item.transform[5];
  if (
    left === undefined ||
    bottom === undefined ||
    right === undefined ||
    top === undefined ||
    x === undefined ||
    baseline === undefined
  ) {
    return false;
  }
  const itemRight = x + item.width;
  const itemBottom = baseline - Math.max(1, item.height * 0.25);
  const itemTop = baseline + item.height;
  return (
    itemRight >= left && x <= right && itemTop >= bottom && itemBottom <= top
  );
}

export async function extractPdfLiveLinks(bytes: Uint8Array) {
  const loadingTask = getDocument({ data: bytes });
  const source = await loadingTask.promise;
  const links: Array<{ pageNumber: number; y: number; url: string }> = [];
  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const [content, annotations] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations(),
      ]);
      const textItems = content.items.filter(isPdfTextItem);
      for (const annotation of annotations) {
        if (
          annotation.subtype !== "Link" ||
          typeof annotation.url !== "string" ||
          !/^https?:\/\//i.test(annotation.url) ||
          !Array.isArray(annotation.rect)
        ) {
          continue;
        }
        const anchor = textItems
          .filter((item) => textOverlapsLink(item, annotation.rect))
          .sort(
            (left, right) =>
              (left.transform[4] ?? 0) - (right.transform[4] ?? 0),
          )
          .map((item) => item.str)
          .join(" ");
        if (/\bLive\b/i.test(anchor)) {
          links.push({
            pageNumber,
            y: Number(annotation.rect[1] ?? 0),
            url: annotation.url,
          });
        }
      }
    }
  } finally {
    await loadingTask.destroy();
  }
  return links
    .sort(
      (left, right) => left.pageNumber - right.pageNumber || right.y - left.y,
    )
    .map((link) => link.url);
}

function renderPdfContacts(
  document: PDFKit.PDFDocument,
  contacts: string[],
  compact: boolean,
) {
  const separator = "  |  ";
  const availableWidth =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right;
  const rows: string[][] = [];
  let row: string[] = [];
  let rowWidth = 0;
  for (const contact of contacts) {
    const width = document.widthOfString(contact);
    const separatorWidth = row.length ? document.widthOfString(separator) : 0;
    if (row.length && rowWidth + separatorWidth + width > availableWidth) {
      rows.push(row);
      row = [contact];
      rowWidth = width;
    } else {
      row.push(contact);
      rowWidth += separatorWidth + width;
    }
  }
  if (row.length) rows.push(row);

  for (const contactRow of rows) {
    const totalWidth = contactRow.reduce(
      (width, contact, index) =>
        width +
        document.widthOfString(contact) +
        (index ? document.widthOfString(separator) : 0),
      0,
    );
    let x = (document.page.width - totalWidth) / 2;
    const y = document.y;
    const lineHeight = document.currentLineHeight(true);
    contactRow.forEach((contact, index) => {
      if (index) {
        document
          .fillColor("#8A838E")
          .text(separator, x, y, { lineBreak: false });
        x += document.widthOfString(separator);
      }
      const link = pdfLinkTarget(contact);
      document.fillColor(link ? "#49335E" : "#57515F").text(contact, x, y, {
        lineBreak: false,
        ...(link ? { link } : {}),
      });
      x += document.widthOfString(contact);
    });
    document.x = document.page.margins.left;
    document.y = y + lineHeight + (compact ? 1 : 2);
  }

  document.x = document.page.margins.left;
}

async function renderPdf(
  resume: ProfessionalResumeDocument,
  density: ResumeTemplateDensity,
  sourceProjectLinks: readonly string[],
) {
  const compact = density === "compact";
  const document = new PDFDocument({
    size: "LETTER",
    margins: { top: 44, right: 50, bottom: 44, left: 50 },
    info: {
      Title: `${resume.name} Resume`,
      Author: resume.name,
      Subject: "Professional resume",
      Creator: "Make My Resume",
    },
  });
  const pending = pdfBuffer(document);
  const bodySize = compact ? 8.9 : 9.6;
  const bodyGap = compact ? 1.5 : 2.4;
  const sectionGap = compact ? 9 : 13;
  const itemGap = compact ? 5 : 8;
  let projectIndex = 0;

  document
    .fillColor("#211535")
    .font("Times-Bold")
    .fontSize(compact ? 21 : 24)
    .text(resume.name, { align: "center" });
  if (resume.headline) {
    document
      .moveDown(0.18)
      .fillColor("#36313d")
      .font("Helvetica")
      .fontSize(compact ? 9.2 : 10)
      .text(resume.headline, { align: "center" });
  }
  if (resume.contact.length) {
    document
      .moveDown(0.25)
      .fillColor("#57515f")
      .font("Helvetica")
      .fontSize(compact ? 7.8 : 8.4);
    renderPdfContacts(document, resume.contact, compact);
  }
  document.moveDown(compact ? 0.65 : 0.9);

  for (const section of resume.sections) {
    ensurePdfSpace(document, compact ? 42 : 52);
    document
      .moveDown(sectionGap / bodySize)
      .fillColor("#211535")
      .font("Helvetica-Bold")
      .fontSize(compact ? 8.8 : 9.4)
      .text(section.title.toLocaleUpperCase("en"), {
        characterSpacing: 0.75,
      });
    document.moveDown(compact ? 0.35 : 0.5);

    for (const item of section.items) {
      const sourceProjectLink =
        section.kind === "projects"
          ? (sourceProjectLinks[projectIndex++] ?? null)
          : null;
      const liveLink =
        section.kind === "projects"
          ? (projectLiveLink(item) ?? sourceProjectLink)
          : null;
      ensurePdfSpace(document, item.heading ? 36 : 26);
      if (item.heading) {
        document
          .fillColor("#1f1d22")
          .font("Helvetica-Bold")
          .fontSize(compact ? 9.4 : 10)
          .text(item.heading, {
            ...(liveLink && /\bLive\b/i.test(item.heading)
              ? { link: liveLink }
              : {}),
          });
        document.moveDown(0.18);
      }
      document.fillColor("#29262e").font("Helvetica").fontSize(bodySize);
      for (const line of bodyLines(item.body)) {
        renderPdfLinkedLine(document, line, { lineGap: bodyGap }, liveLink);
      }
      document.moveDown(itemGap / bodySize);
    }
  }

  document.end();
  return pending;
}

function itemParagraphs(item: ResumeDocumentItem, compact: boolean) {
  const paragraphs: Paragraph[] = [];
  if (item.heading) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: item.heading,
            bold: true,
            color: "1F1D22",
            font: "Arial",
            size: compact ? 19 : 20,
          }),
        ],
        keepNext: true,
        spacing: { before: compact ? 70 : 100, after: 35 },
      }),
    );
  }
  const lines = bodyLines(item.body);
  paragraphs.push(
    new Paragraph({
      children: lines.flatMap((line, index) => [
        ...(index > 0 ? [new TextRun({ break: 1 })] : []),
        new TextRun({
          text: line,
          color: "29262E",
          font: "Arial",
          size: compact ? 18 : 19,
        }),
      ]),
      spacing: {
        after: compact ? 80 : 120,
        line: compact ? 225 : 245,
      },
    }),
  );
  return paragraphs;
}

async function renderDocx(
  resume: ProfessionalResumeDocument,
  density: ResumeTemplateDensity,
) {
  const compact = density === "compact";
  const children: Paragraph[] = [
    new Paragraph({
      text: resume.name,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: compact ? 45 : 70 },
    }),
  ];
  if (resume.headline) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.headline,
            color: "36313D",
            font: "Arial",
            size: compact ? 19 : 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 55 },
      }),
    );
  }
  if (resume.contact.length) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.contact.join("  |  "),
            color: "57515F",
            font: "Arial",
            size: compact ? 16 : 17,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: compact ? 130 : 180 },
        tabStops: [
          { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
        ],
      }),
    );
  }

  for (const section of resume.sections) {
    children.push(
      new Paragraph({
        text: section.title.toLocaleUpperCase("en"),
        heading: HeadingLevel.HEADING_1,
        keepNext: true,
        spacing: {
          before: compact ? 120 : 180,
          after: compact ? 60 : 85,
        },
      }),
    );
    for (const item of section.items) {
      children.push(...itemParagraphs(item, compact));
    }
  }

  const document = new Document({
    creator: "Make My Resume",
    title: `${resume.name} Resume`,
    description: "Professional resume",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: compact ? 18 : 19, color: "29262E" },
          paragraph: { spacing: { line: compact ? 225 : 245 } },
        },
        title: {
          run: {
            font: "Times New Roman",
            size: compact ? 42 : 48,
            bold: true,
            color: "000000",
          },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
        heading1: {
          run: {
            font: "Arial",
            size: compact ? 18 : 19,
            bold: true,
            color: "000000",
            allCaps: true,
          },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12_240, height: 15_840 },
            margin: { top: 720, right: 792, bottom: 720, left: 792 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

export async function renderProfessionalResume(
  resume: ProfessionalResumeDocument,
  format: "pdf" | "docx",
  density: ResumeTemplateDensity,
  sourceProjectLinks: readonly string[] = [],
): Promise<ResumeExportResult> {
  if (format === "pdf") {
    return {
      bytes: await renderPdf(resume, density, sourceProjectLinks),
      contentType: "application/pdf",
      extension: "pdf",
    };
  }
  return {
    bytes: await renderDocx(resume, density),
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  };
}
