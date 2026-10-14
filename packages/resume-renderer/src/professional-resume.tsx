import type {
  ProfessionalResumeDocument,
  ResumeDocumentItem,
  ResumeDocumentSection,
  ResumePresentationSettings,
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
import type { CSSProperties, ReactNode } from "react";

export interface ProfessionalResumeProps {
  document: ProfessionalResumeDocument;
  density?: ResumeTemplateDensity;
  presentation?: ResumePresentationSettings;
  className?: string;
}

function contactHref(value: string) {
  const trimmed = value.trim();
  if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  if (/^\+?[\d ().-]{8,}$/.test(trimmed)) {
    return `tel:${trimmed.replace(/[^\d+]/g, "")}`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (
    /^(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[^\s]*)?$/i.test(trimmed)
  ) {
    return `https://${trimmed}`;
  }
  return null;
}

function contactLabel(value: string) {
  if (/linkedin\.com/i.test(value)) return "LinkedIn";
  if (/github\.com/i.test(value)) return "GitHub";
  if (/^(?:https?:\/\/|www\.)/i.test(value)) return "Portfolio";
  return value;
}

function projectLiveLink(heading: string | null, body: string) {
  const content = [heading, body].filter(Boolean).join("\n");
  const explicit = content.match(
    /\bLive\b\s*\(\s*((?:https?:\/\/|www\.)[^\s|,;)]+)\s*\)/i,
  );
  if (explicit?.[1]) return contactHref(explicit[1]);
  const urls = [
    ...new Set(
      Array.from(
        content.matchAll(
          /(?:https?:\/\/|www\.)[^\s|,;)]+|(?:linkedin\.com|github\.com)\/[^\s|,;)]+/gi,
        ),
        (match) => contactHref(match[0]),
      ).filter((url): url is string => Boolean(url)),
    ),
  ];
  const onlyUrl = urls.length === 1 ? (urls[0] ?? null) : null;
  if (!onlyUrl) return null;
  const repositoryLabel = content.match(
    /\b(?:GitHub|Repository|Source(?:\s+code)?)\b\s*\(\s*((?:https?:\/\/|www\.)[^\s|,;)]+)\s*\)/i,
  );
  return repositoryLabel?.[1] && contactHref(repositoryLabel[1]) === onlyUrl
    ? null
    : onlyUrl;
}

function linkedProjectText(value: string, liveLink: string | null) {
  const fragments: ReactNode[] = [];
  const pattern =
    /\bLive\b(?:\s*\(\s*(?:https?:\/\/|www\.)[^\s|,;)]+\s*\))?|(?:https?:\/\/|www\.)[^\s|,;)]+|(?:linkedin\.com|github\.com)\/[^\s|,;)]+/gi;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) fragments.push(value.slice(cursor, index));
    const raw = match[0];
    const isLive = /^Live\b/i.test(raw);
    const label = isLive ? (raw.match(/^Live\b/i)?.[0] ?? "Live") : raw;
    const href = isLive ? liveLink : contactHref(raw);
    if (!href) {
      fragments.push(label);
      cursor = index + raw.length;
      continue;
    }
    fragments.push(
      <a href={href} key={`${index}-${raw}`} rel="noreferrer" target="_blank">
        {label}
      </a>,
    );
    cursor = index + raw.length;
  }
  if (cursor < value.length) fragments.push(value.slice(cursor));
  return fragments.length ? fragments : value;
}

function bodyLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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

function parseExperienceMetadata(value: string, heading: string) {
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

function ResumeItem({
  item,
  kind,
}: {
  item: ResumeDocumentItem;
  kind: ResumeDocumentSection["kind"];
}) {
  const liveLink =
    kind === "projects" ? projectLiveLink(item.heading, item.body) : null;
  const lines = bodyLines(item.body);
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line));
  const prose = lines.filter((line) => !/^[-*]\s+/.test(line));
  const experienceMetadata =
    kind === "experience" && item.heading && prose[0]
      ? parseExperienceMetadata(prose[0], item.heading)
      : null;
  const project =
    kind === "projects" && prose[0] ? projectMetadata(prose[0]) : null;
  const education =
    kind === "education" && prose[0] ? educationMetadata(prose[0]) : null;
  const consumedFirstLine = Boolean(experienceMetadata || project || education);

  return (
    <div className="professional-resume__item">
      {experienceMetadata ? (
        <>
          <div className="professional-resume__item-header">
            <h3>{experienceMetadata.role}</h3>
            {experienceMetadata.date && <span>{experienceMetadata.date}</span>}
          </div>
          <div className="professional-resume__item-subheader">
            <em>{experienceMetadata.organization}</em>
            {experienceMetadata.location && (
              <em>{experienceMetadata.location}</em>
            )}
          </div>
        </>
      ) : kind === "projects" && item.heading ? (
        <div className="professional-resume__item-header">
          <div className="professional-resume__project-heading">
            <h3>{linkedProjectText(item.heading, liveLink)}</h3>
            {project?.detail && (
              <span>{linkedProjectText(` | ${project.detail}`, liveLink)}</span>
            )}
          </div>
          {project?.date && <span>{project.date}</span>}
        </div>
      ) : kind === "education" && item.heading && education ? (
        <>
          <div className="professional-resume__item-header">
            <h3>{education.institution || item.heading}</h3>
            {education.location && <span>{education.location}</span>}
          </div>
          <div className="professional-resume__item-subheader">
            <em>{item.heading}</em>
            {education.date && <em>{education.date}</em>}
          </div>
        </>
      ) : (
        item.heading && <h3>{linkedProjectText(item.heading, liveLink)}</h3>
      )}

      {prose.slice(consumedFirstLine ? 1 : 0).map((line, index) => {
        const skill =
          kind === "skills" ? line.match(/^([^:]{1,50}):\s*(.+)$/) : null;
        return (
          <p key={`${item.id}-line-${index}`}>
            {skill ? (
              <>
                <strong>{skill[1]}:</strong> {skill[2]}
              </>
            ) : (
              linkedProjectText(line, liveLink)
            )}
          </p>
        );
      })}
      {bullets.length > 0 && (
        <ul className="professional-resume__bullets">
          {bullets.map((line, index) => (
            <li key={`${item.id}-bullet-${index}`}>
              {linkedProjectText(line.replace(/^[-*]\s+/, ""), liveLink)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfessionalResume({
  document,
  density,
  presentation = DEFAULT_RESUME_PRESENTATION,
  className,
}: ProfessionalResumeProps) {
  const resolved = normalizeResumePresentation({
    ...presentation,
    density: density ?? presentation.density,
  });
  const displayedDocument = applyResumePresentation(document, resolved);
  const style = {
    "--resume-accent": RESUME_ACCENT_COLORS[resolved.accentColor],
  } as CSSProperties;

  return (
    <article
      className={["professional-resume", className].filter(Boolean).join(" ")}
      data-density={resolved.density}
      data-font={resolved.fontFamily}
      data-resume-renderer="professional-ats"
      data-template={resolved.template}
      style={style}
    >
      <header className="professional-resume__header">
        <h1>{displayedDocument.name}</h1>
        {displayedDocument.headline && <p>{displayedDocument.headline}</p>}
        {displayedDocument.contact.length > 0 && (
          <ul aria-label="Contact information">
            {displayedDocument.contact.map((detail) => {
              const href = contactHref(detail);
              return (
                <li key={detail}>
                  {href ? (
                    <a
                      href={href}
                      rel={href.startsWith("http") ? "noreferrer" : undefined}
                      target={href.startsWith("http") ? "_blank" : undefined}
                    >
                      {contactLabel(detail)}
                    </a>
                  ) : (
                    detail
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </header>

      {displayedDocument.sections.map((section) => (
        <section
          className="professional-resume__section"
          data-section={section.kind}
          key={section.kind}
        >
          <h2>{section.title}</h2>
          <div className="professional-resume__items">
            {section.items.map((item) => (
              <ResumeItem item={item} key={item.id} kind={section.kind} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
