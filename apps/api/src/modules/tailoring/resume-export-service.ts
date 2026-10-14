import type {
  ProfessionalResumeDocument,
  ResumeDocumentItem,
  ResumePresentationSettings,
  ResumeClaim,
  ResumeMimeType,
  ResumeTemplateDensity,
} from "@make-my-resume/contracts";
import {
  DEFAULT_RESUME_PRESENTATION,
  RESUME_ACCENT_COLORS,
} from "@make-my-resume/contracts";
import {
  applyResumePresentation,
  normalizeResumePresentation,
} from "@make-my-resume/resume-engine";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
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

import { extractDocumentText } from "../resumes/document-text-extractor.js";

export interface ResumeExportResult {
  bytes: Buffer;
  contentType: string;
  extension: "pdf" | "docx";
}

export interface SourceContactLink {
  label: string;
  url: string;
}

export interface DocumentSourceLinks {
  projectLinks: string[];
  contactLinks: SourceContactLink[];
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

function contactDisplayLabel(value: string) {
  if (/linkedin\.com/i.test(value)) return "LinkedIn";
  if (/github\.com/i.test(value)) return "GitHub";
  if (/^(?:https?:\/\/|www\.)/i.test(value)) return "Portfolio";
  return value;
}

function metadataParts(value: string) {
  return value
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isDateMetadata(value: string) {
  return /\b(?:19|20)\d{2}\b|\bpresent\b/i.test(value);
}

function experienceMetadata(value: string, heading: string) {
  const parts = metadataParts(value);
  const date = parts.find(isDateMetadata) ?? "";
  if (!date) {
    return null;
  }
  const remaining = parts.filter((part) => part !== date);
  const headingMatch = heading.match(/^(.+?)\s+at\s+(.+)$/i);
  return {
    role: headingMatch?.[1] ?? heading,
    organization: headingMatch?.[2] ?? remaining.shift() ?? "",
    location: remaining.join(", "),
    date,
  };
}

function projectMetadata(value: string) {
  const parts = metadataParts(value);
  if (parts.length < 2 && !/\bLive\b|https?:\/\/|www\./i.test(value)) {
    return null;
  }
  const date = parts.find(isDateMetadata) ?? "";
  return {
    detail: parts.filter((part) => part !== date).join(" | "),
    date,
  };
}

function educationMetadata(value: string) {
  const parts = metadataParts(value);
  if (parts.length < 2) return null;
  const date = parts.find(isDateMetadata) ?? "";
  const remaining = parts.filter((part) => part !== date);
  return {
    institution: remaining.shift() ?? "",
    date,
    location: remaining.join(", "),
  };
}

const inlineLinkPattern =
  /(?:https?:\/\/|www\.)[^\s|,;]+|(?:linkedin\.com|github\.com)\/[^\s|,;]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi;

function pdfTextFragments(value: string, liveLink: string | null = null) {
  const fragments: Array<{ text: string; link: string | null }> = [];
  let cursor = 0;
  const pattern = liveLink
    ? /\bLive\b(?:\s*\(\s*(?:https?:\/\/|www\.)[^\s|,;)]+\s*\))?|(?:https?:\/\/|www\.)[^\s|,;]+|(?:linkedin\.com|github\.com)\/[^\s|,;]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi
    : inlineLinkPattern;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? cursor;
    if (index > cursor)
      fragments.push({ text: value.slice(cursor, index), link: null });
    const raw = match[0];
    const isLive = /^Live\b/i.test(raw);
    const linkedText = isLive
      ? (raw.match(/^Live\b/i)?.[0] ?? "Live")
      : raw.replace(/[.)]+$/, "");
    fragments.push({
      text: linkedText,
      link: liveLink && isLive ? liveLink : pdfLinkTarget(linkedText),
    });
    if (!isLive && linkedText.length < raw.length)
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
  colors: { link: string; text: string } | null = null,
) {
  const fragments = pdfTextFragments(value, liveLink);
  fragments.forEach((fragment, index) => {
    if (colors) document.fillColor(fragment.link ? colors.link : colors.text);
    document.text(fragment.text, {
      ...options,
      continued: index < fragments.length - 1,
      ...(fragment.link ? { link: fragment.link } : {}),
    });
  });
}

function renderPdfBullet(
  document: PDFKit.PDFDocument,
  value: string,
  lineGap: number,
  liveLink: string | null,
) {
  const left = document.page.margins.left;
  const y = document.y;
  const width =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right;
  document.text("•", left + 12, y, { lineBreak: false });
  document.x = left + 24;
  document.y = y;
  renderPdfLinkedLine(
    document,
    value.replace(/^[-*]\s+/, ""),
    { lineGap, width: width - 24 },
    liveLink,
  );
  document.x = left;
}

function uniqueProjectUrls(value: string) {
  return [
    ...new Set(
      Array.from(
        value.matchAll(
          /(?:https?:\/\/|www\.)[^\s|,;)]+|(?:linkedin\.com|github\.com)\/[^\s|,;)]+/gi,
        ),
        (match) => pdfLinkTarget(match[0].replace(/[.)]+$/, "")),
      ).filter((url): url is string => Boolean(url)),
    ),
  ];
}

function explicitLiveLink(value: string) {
  const match = value.match(
    /\bLive\b\s*\(\s*((?:https?:\/\/|www\.)[^\s|,;)]+)\s*\)/i,
  );
  return match?.[1] ? pdfLinkTarget(match[1]) : null;
}

function projectLiveLink(item: ResumeDocumentItem) {
  const content = [item.heading, item.body].filter(Boolean).join("\n");
  const liveLink = explicitLiveLink(content);
  if (liveLink) return liveLink;
  const urls = uniqueProjectUrls(content);
  const onlyUrl = urls.length === 1 ? (urls[0] ?? null) : null;
  if (!onlyUrl) return null;
  const repositoryLabel = content.match(
    /\b(?:GitHub|Repository|Source(?:\s+code)?)\b\s*\(\s*((?:https?:\/\/|www\.)[^\s|,;)]+)\s*\)/i,
  );
  return repositoryLabel?.[1] && pdfLinkTarget(repositoryLabel[1]) === onlyUrl
    ? null
    : onlyUrl;
}

export function attachProjectLinksToClaims(claims: readonly ResumeClaim[]) {
  const legacyLinksByClaimId = new Map(
    claims.flatMap((claim) => {
      if (
        claim.category !== "projects" ||
        claim.userAdded ||
        claim.status === "edited" ||
        claim.status === "rejected" ||
        !claim.sourceText
      ) {
        return [];
      }
      const link = explicitLiveLink(claim.sourceText);
      return link ? ([[claim.id, link]] as const) : [];
    }),
  );
  return claims.map((claim) => {
    if (claim.category !== "projects") return claim;
    if (
      projectLiveLink({
        id: claim.id,
        sourceClaimId: claim.id,
        heading: null,
        body: claim.value,
        tailored: false,
      })
    ) {
      return claim;
    }
    const link = legacyLinksByClaimId.get(claim.id);
    if (!link) return claim;
    if (/\bLive\b/i.test(claim.value)) {
      return {
        ...claim,
        value: claim.value.replace(
          /\bLive\b/i,
          (label) => `${label} (${link})`,
        ),
      };
    }
    const firstSeparator = claim.value.indexOf("|");
    if (firstSeparator >= 0 && firstSeparator <= 160) {
      return {
        ...claim,
        value: `${claim.value.slice(0, firstSeparator).trim()} | Live (${link}) | ${claim.value.slice(firstSeparator + 1).trim()}`,
      };
    }
    return {
      ...claim,
      value: `Live (${link}) | ${claim.value}`,
    };
  });
}

export function attachContactLinksToClaims(claims: readonly ResumeClaim[]) {
  const legacyLinksByClaimId = new Map(
    claims.flatMap((claim) => {
      if (
        claim.category !== "personal_info" ||
        claim.userAdded ||
        claim.status === "edited" ||
        claim.status === "rejected" ||
        !claim.sourceText
      ) {
        return [];
      }
      const links = Array.from(
        claim.sourceText.matchAll(
          /\b(LinkedIn|GitHub|Portfolio|Website|Site)\b\s*\(\s*(https?:\/\/[^\s|,;)]+)\s*\)/gi,
        ),
        (match) => ({ label: match[1] ?? "Website", url: match[2] ?? "" }),
      ).filter(
        ({ url }, index, sourceLinks) =>
          Boolean(url) &&
          sourceLinks.findIndex((link) => link.url === url) === index,
      );
      return links.length ? ([[claim.id, links]] as const) : [];
    }),
  );
  return claims.map((claim) => {
    if (claim.category !== "personal_info") return claim;
    const sourceLinks = legacyLinksByClaimId.get(claim.id) ?? [];
    const missingLinks = sourceLinks.filter(
      ({ url }) => !claim.value.includes(url),
    );
    if (!missingLinks.length) return claim;
    return {
      ...claim,
      value: [
        claim.value,
        ...missingLinks.map(({ label, url }) => `${label} (${url})`),
      ].join("\n"),
    };
  });
}

function isPdfTextItem(value: TextItem | TextMarkedContent): value is TextItem {
  return "str" in value;
}

function textOverlapsLink(item: TextItem, rect: number[]) {
  const [firstX, firstY, secondX, secondY] = rect;
  const x = item.transform[4];
  const baseline = item.transform[5];
  if (
    firstX === undefined ||
    firstY === undefined ||
    secondX === undefined ||
    secondY === undefined ||
    x === undefined ||
    baseline === undefined
  ) {
    return false;
  }
  const left = Math.min(firstX, secondX);
  const right = Math.max(firstX, secondX);
  const bottom = Math.min(firstY, secondY);
  const top = Math.max(firstY, secondY);
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

async function extractPdfSourceLinks(
  bytes: Uint8Array,
): Promise<DocumentSourceLinks> {
  const loadingTask = getDocument({ data: bytes });
  const source = await loadingTask.promise;
  const links: Array<{ pageNumber: number; y: number; url: string }> = [];
  const contactLinks: SourceContactLink[] = [];
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
        } else if (
          /\b(?:LinkedIn|GitHub|Portfolio|Website|Site)\b/i.test(anchor)
        ) {
          const label =
            anchor.match(
              /\b(?:LinkedIn|GitHub|Portfolio|Website|Site)\b/i,
            )?.[0] ?? "Website";
          if (!contactLinks.some((link) => link.url === annotation.url)) {
            contactLinks.push({ label, url: annotation.url });
          }
        }
      }
    }
  } finally {
    await loadingTask.destroy();
  }
  return {
    projectLinks: links
      .sort(
        (left, right) => left.pageNumber - right.pageNumber || right.y - left.y,
      )
      .map((link) => link.url),
    contactLinks,
  };
}

export async function extractDocumentSourceLinks(
  bytes: Uint8Array,
  mimeType: ResumeMimeType,
): Promise<DocumentSourceLinks> {
  if (mimeType === "application/pdf") return extractPdfSourceLinks(bytes);
  const pages = await extractDocumentText(bytes, mimeType);
  const projectLinks = pages.flatMap((page) =>
    Array.from(
      page.text.matchAll(/\bLive\b\s*\(\s*(https?:\/\/[^\s|,;)]+)\s*\)/gi),
      (match) => match[1],
    ).filter((link): link is string => Boolean(link)),
  );
  const contactLinks = pages.flatMap((page) =>
    Array.from(
      page.text.matchAll(
        /\b(LinkedIn|GitHub|Portfolio|Website|Site)\b\s*\(\s*(https?:\/\/[^\s|,;)]+)\s*\)/gi,
      ),
      (match) => ({ label: match[1] ?? "Website", url: match[2] ?? "" }),
    ).filter(({ url }) => Boolean(url)),
  );
  return {
    projectLinks: [...new Set(projectLinks)],
    contactLinks: contactLinks.filter(
      ({ url }, index) =>
        contactLinks.findIndex((link) => link.url === url) === index,
    ),
  };
}

export async function extractPdfLiveLinks(bytes: Uint8Array) {
  return (await extractPdfSourceLinks(bytes)).projectLinks;
}

export async function extractDocumentLiveLinks(
  bytes: Uint8Array,
  mimeType: ResumeMimeType,
) {
  return (await extractDocumentSourceLinks(bytes, mimeType)).projectLinks;
}

function renderPdfContacts(
  document: PDFKit.PDFDocument,
  contacts: string[],
  compact: boolean,
  alignment: "left" | "center",
  accent: string,
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
    const width = document.widthOfString(contactDisplayLabel(contact));
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
        document.widthOfString(contactDisplayLabel(contact)) +
        (index ? document.widthOfString(separator) : 0),
      0,
    );
    let x =
      alignment === "center"
        ? (document.page.width - totalWidth) / 2
        : document.page.margins.left;
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
      const label = contactDisplayLabel(contact);
      const linkColor = link && !link.startsWith("tel:") ? accent : "#242126";
      document.fillColor(linkColor).text(label, x, y, {
        lineBreak: false,
        ...(link ? { link } : {}),
      });
      x += document.widthOfString(label);
    });
    document.x = document.page.margins.left;
    document.y = y + lineHeight + (compact ? 1 : 2);
  }

  document.x = document.page.margins.left;
}

function renderPdfSplitLine(
  document: PDFKit.PDFDocument,
  left: string,
  right: string,
  options: {
    leftFont: string;
    rightFont?: string;
    size: number;
    liveLink?: string | null;
    linkColor?: string;
  },
) {
  const x = document.page.margins.left;
  const y = document.y;
  const width =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right;
  const rightWidth = right
    ? Math.min(
        width * 0.32,
        document
          .font(options.rightFont ?? options.leftFont)
          .fontSize(options.size)
          .widthOfString(right) + 5,
      )
    : 0;
  document.x = x;
  document.y = y;
  document.font(options.leftFont).fontSize(options.size);
  renderPdfLinkedLine(
    document,
    left,
    { lineBreak: false, width: width - rightWidth - (right ? 8 : 0) },
    options.liveLink,
    options.linkColor ? { link: options.linkColor, text: "#1f1d22" } : null,
  );
  if (right) {
    document
      .fillColor("#1f1d22")
      .font(options.rightFont ?? options.leftFont)
      .fontSize(options.size)
      .text(right, x, y, { align: "right", lineBreak: false, width });
  }
  document.x = x;
  document.y = y + document.currentLineHeight(true) + 1;
}

async function renderPdf(
  resume: ProfessionalResumeDocument,
  presentation: ResumePresentationSettings,
) {
  const compact =
    presentation.density === "compact" || presentation.template === "compact";
  const classic = presentation.template === "professional";
  const leftAligned = presentation.template !== "professional";
  const accent = classic
    ? "#111111"
    : RESUME_ACCENT_COLORS[presentation.accentColor];
  const titleFont =
    classic || presentation.fontFamily !== "sans"
      ? "Times-Bold"
      : "Helvetica-Bold";
  const bodyFont =
    classic || presentation.fontFamily === "serif"
      ? "Times-Roman"
      : "Helvetica";
  const bodyBoldFont =
    classic || presentation.fontFamily === "serif"
      ? "Times-Bold"
      : "Helvetica-Bold";
  const bodyItalicFont =
    classic || presentation.fontFamily === "serif"
      ? "Times-Italic"
      : "Helvetica-Oblique";
  const horizontalMargin = classic
    ? 36
    : presentation.template === "compact"
      ? 42
      : 50;
  const document = new PDFDocument({
    size: "LETTER",
    margins: {
      top: classic ? 30 : presentation.template === "compact" ? 36 : 44,
      right: horizontalMargin,
      bottom: classic ? 30 : presentation.template === "compact" ? 36 : 44,
      left: horizontalMargin,
    },
    info: {
      Title: `${resume.name} Resume`,
      Author: resume.name,
      Subject: "Professional resume",
      Creator: "Make My Resume",
    },
  });
  const pending = pdfBuffer(document);
  const bodySize = classic ? 9.25 : compact ? 8.9 : 9.6;
  const bodyGap = classic ? 0.8 : compact ? 1.5 : 2.4;
  const sectionGap = classic ? 7 : compact ? 9 : 13;
  const itemGap = classic ? 3.5 : compact ? 5 : 8;
  document
    .fillColor(accent)
    .font(titleFont)
    .fontSize(
      classic
        ? 25
        : compact
          ? 20
          : presentation.template === "modern"
            ? 25
            : 24,
    )
    .text(resume.name, { align: leftAligned ? "left" : "center" });
  if (resume.headline) {
    document
      .moveDown(0.18)
      .fillColor("#36313d")
      .font(bodyFont)
      .fontSize(compact ? 9.2 : 10)
      .text(resume.headline, { align: leftAligned ? "left" : "center" });
  }
  if (resume.contact.length) {
    document
      .moveDown(0.25)
      .fillColor("#57515f")
      .font(bodyFont)
      .fontSize(classic ? 8.8 : compact ? 7.8 : 8.4);
    renderPdfContacts(
      document,
      resume.contact,
      compact,
      leftAligned ? "left" : "center",
      classic ? "#1746d1" : accent,
    );
  }
  if (presentation.template === "modern") {
    const ruleY = document.y + 4;
    document
      .moveTo(document.page.margins.left, ruleY)
      .lineTo(document.page.width - document.page.margins.right, ruleY)
      .lineWidth(1.2)
      .strokeColor(accent)
      .stroke();
    document.y = ruleY + 3;
  }
  document.moveDown(classic ? 0.25 : compact ? 0.65 : 0.9);

  for (const section of resume.sections) {
    ensurePdfSpace(document, compact ? 42 : 52);
    document
      .moveDown(sectionGap / bodySize)
      .fillColor(accent)
      .font(bodyBoldFont)
      .fontSize(classic ? 11 : compact ? 8.8 : 9.4)
      .text(section.title.toLocaleUpperCase("en"), {
        characterSpacing: classic ? 0.3 : 0.75,
      });
    if (presentation.template === "modern" || classic) {
      const ruleY = document.y + 1;
      document
        .moveTo(document.page.margins.left, ruleY)
        .lineTo(document.page.width - document.page.margins.right, ruleY)
        .lineWidth(classic ? 0.45 : 0.55)
        .strokeColor(accent)
        .stroke();
      document.y = ruleY + 2;
    }
    document.moveDown(classic ? 0.12 : compact ? 0.35 : 0.5);

    for (const item of section.items) {
      const liveLink =
        section.kind === "projects" ? projectLiveLink(item) : null;
      ensurePdfSpace(document, item.heading ? 36 : 26);
      const lines = bodyLines(item.body);
      const prose = lines.filter((line) => !/^[-*]\s+/.test(line));
      const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
      const experienceMeta =
        classic && section.kind === "experience" && item.heading && prose[0]
          ? experienceMetadata(prose[0], item.heading)
          : null;
      const projectMeta =
        classic && section.kind === "projects" && prose[0]
          ? projectMetadata(prose[0])
          : null;
      const educationMeta =
        classic && section.kind === "education" && prose[0]
          ? educationMetadata(prose[0])
          : null;

      if (experienceMeta) {
        renderPdfSplitLine(document, experienceMeta.role, experienceMeta.date, {
          leftFont: bodyBoldFont,
          rightFont: bodyFont,
          size: bodySize + 0.8,
        });
        renderPdfSplitLine(
          document,
          experienceMeta.organization,
          experienceMeta.location,
          {
            leftFont: bodyItalicFont,
            rightFont: bodyItalicFont,
            size: bodySize,
          },
        );
      } else if (classic && section.kind === "projects" && item.heading) {
        renderPdfSplitLine(
          document,
          [item.heading, projectMeta?.detail].filter(Boolean).join(" | "),
          projectMeta?.date ?? "",
          {
            leftFont: bodyBoldFont,
            rightFont: bodyFont,
            size: bodySize + 0.6,
            liveLink,
            linkColor: "#1746d1",
          },
        );
      } else if (
        classic &&
        section.kind === "education" &&
        item.heading &&
        educationMeta
      ) {
        renderPdfSplitLine(
          document,
          educationMeta.institution || item.heading,
          educationMeta.location,
          {
            leftFont: bodyBoldFont,
            rightFont: bodyFont,
            size: bodySize + 0.8,
          },
        );
        renderPdfSplitLine(document, item.heading, educationMeta.date, {
          leftFont: bodyItalicFont,
          rightFont: bodyItalicFont,
          size: bodySize,
        });
      } else if (item.heading) {
        document
          .fillColor("#1f1d22")
          .font(bodyBoldFont)
          .fontSize(compact ? 9.4 : 10)
          .text(item.heading, {
            ...(liveLink && /\bLive\b/i.test(item.heading)
              ? { link: liveLink }
              : {}),
          });
        document.moveDown(0.18);
      }
      document.fillColor("#29262e").font(bodyFont).fontSize(bodySize);
      const consumedFirstLine = Boolean(
        experienceMeta || projectMeta || educationMeta,
      );
      for (const line of prose.slice(consumedFirstLine ? 1 : 0)) {
        renderPdfLinkedLine(document, line, { lineGap: bodyGap }, liveLink);
      }
      for (const line of bulletLines) {
        if (classic) {
          renderPdfBullet(document, line, bodyGap, liveLink);
        } else {
          renderPdfLinkedLine(document, line, { lineGap: bodyGap }, liveLink);
        }
      }
      document.moveDown(itemGap / bodySize);
    }
  }

  document.end();
  return pending;
}

function itemParagraphs(
  item: ResumeDocumentItem,
  compact: boolean,
  bodyFont: string,
  liveLink: string | null = null,
) {
  const paragraphs: Paragraph[] = [];
  const linkedRuns = (
    value: string,
    options: { bold?: boolean; color: string; size: number },
  ) => {
    const children: Array<TextRun | ExternalHyperlink> = [];
    const pattern =
      /\bLive\b(?:\s*\(\s*(?:https?:\/\/|www\.)[^\s|,;)]+\s*\))?|(?:https?:\/\/|www\.)[^\s|,;)]+|(?:linkedin\.com|github\.com)\/[^\s|,;)]+/gi;
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      const index = match.index ?? cursor;
      if (index > cursor) {
        children.push(
          new TextRun({
            text: value.slice(cursor, index),
            font: bodyFont,
            ...options,
          }),
        );
      }
      const raw = match[0];
      const isLive = /^Live\b/i.test(raw);
      const label = isLive ? (raw.match(/^Live\b/i)?.[0] ?? "Live") : raw;
      const link = isLive ? liveLink : pdfLinkTarget(raw);
      if (!link) {
        children.push(new TextRun({ text: label, font: bodyFont, ...options }));
        cursor = index + raw.length;
        continue;
      }
      children.push(
        new ExternalHyperlink({
          link,
          children: [
            new TextRun({
              text: label,
              font: bodyFont,
              style: "Hyperlink",
              ...options,
            }),
          ],
        }),
      );
      cursor = index + raw.length;
    }
    if (cursor < value.length) {
      children.push(
        new TextRun({
          text: value.slice(cursor),
          font: bodyFont,
          ...options,
        }),
      );
    }
    return children;
  };
  if (item.heading) {
    paragraphs.push(
      new Paragraph({
        children: linkedRuns(item.heading, {
          bold: true,
          color: "1F1D22",
          size: compact ? 19 : 20,
        }),
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
        ...linkedRuns(line, {
          color: "29262E",
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
  presentation: ResumePresentationSettings,
) {
  const compact =
    presentation.density === "compact" || presentation.template === "compact";
  const classic = presentation.template === "professional";
  const dense = compact || classic;
  const leftAligned = presentation.template !== "professional";
  const alignment = leftAligned ? AlignmentType.LEFT : AlignmentType.CENTER;
  const accent = classic
    ? "111111"
    : RESUME_ACCENT_COLORS[presentation.accentColor].slice(1);
  const titleFont =
    classic || presentation.fontFamily !== "sans" ? "Times New Roman" : "Arial";
  const bodyFont =
    classic || presentation.fontFamily === "serif"
      ? "Times New Roman"
      : "Arial";
  const children: Paragraph[] = [
    new Paragraph({
      text: resume.name,
      heading: HeadingLevel.TITLE,
      alignment,
      spacing: { after: classic ? 15 : compact ? 45 : 70 },
    }),
  ];
  if (resume.headline) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.headline,
            color: "36313D",
            font: bodyFont,
            size: dense ? 19 : 20,
          }),
        ],
        alignment,
        spacing: { after: 55 },
      }),
    );
  }
  if (resume.contact.length) {
    const contactRuns: Array<TextRun | ExternalHyperlink> = [];
    resume.contact.forEach((contact, index) => {
      if (index) {
        contactRuns.push(
          new TextRun({
            text: " | ",
            color: "57515F",
            font: bodyFont,
            size: dense ? 17 : 18,
          }),
        );
      }
      const link = pdfLinkTarget(contact);
      const label = contactDisplayLabel(contact);
      if (link) {
        const phone = link.startsWith("tel:");
        contactRuns.push(
          new ExternalHyperlink({
            link,
            children: [
              new TextRun({
                text: label,
                font: bodyFont,
                size: dense ? 17 : 18,
                ...(phone ? { color: "29262E" } : { style: "Hyperlink" }),
              }),
            ],
          }),
        );
      } else {
        contactRuns.push(
          new TextRun({
            text: label,
            color: "29262E",
            font: bodyFont,
            size: dense ? 17 : 18,
          }),
        );
      }
    });
    children.push(
      new Paragraph({
        children: contactRuns,
        alignment,
        spacing: { after: classic ? 70 : compact ? 130 : 180 },
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
          before: classic ? 100 : compact ? 120 : 180,
          after: classic ? 35 : compact ? 60 : 85,
        },
        ...(presentation.template === "modern" || classic
          ? {
              border: {
                bottom: {
                  color: accent,
                  size: classic ? 4 : 6,
                  space: classic ? 1 : 3,
                  style: BorderStyle.SINGLE,
                },
              },
            }
          : {}),
      }),
    );
    for (const item of section.items) {
      const liveLink =
        section.kind === "projects" ? projectLiveLink(item) : null;
      children.push(...itemParagraphs(item, dense, bodyFont, liveLink));
    }
  }

  const document = new Document({
    creator: "Make My Resume",
    title: `${resume.name} Resume`,
    description: "Professional resume",
    styles: {
      default: {
        document: {
          run: {
            font: bodyFont,
            size: dense ? 18 : 19,
            color: "29262E",
          },
          paragraph: { spacing: { line: dense ? 215 : 245 } },
        },
        title: {
          run: {
            font: titleFont,
            size: classic ? 54 : compact ? 42 : 48,
            bold: true,
            color: accent,
          },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
        heading1: {
          run: {
            font: bodyFont,
            size: classic ? 22 : compact ? 18 : 19,
            bold: !classic,
            color: accent,
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
            margin: {
              top: classic
                ? 540
                : presentation.template === "compact"
                  ? 576
                  : 720,
              right: classic
                ? 720
                : presentation.template === "compact"
                  ? 672
                  : 792,
              bottom: classic
                ? 540
                : presentation.template === "compact"
                  ? 576
                  : 720,
              left: classic
                ? 720
                : presentation.template === "compact"
                  ? 672
                  : 792,
            },
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
  presentation: ResumePresentationSettings | ResumeTemplateDensity,
): Promise<ResumeExportResult> {
  const resolved = normalizeResumePresentation(
    typeof presentation === "string"
      ? { ...DEFAULT_RESUME_PRESENTATION, density: presentation }
      : presentation,
  );
  const displayedResume = applyResumePresentation(resume, resolved);
  if (format === "pdf") {
    return {
      bytes: await renderPdf(displayedResume, resolved),
      contentType: "application/pdf",
      extension: "pdf",
    };
  }
  return {
    bytes: await renderDocx(displayedResume, resolved),
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  };
}
