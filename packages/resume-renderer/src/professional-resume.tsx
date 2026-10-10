import type {
  ProfessionalResumeDocument,
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
import type { CSSProperties } from "react";

export interface ProfessionalResumeProps {
  document: ProfessionalResumeDocument;
  density?: ResumeTemplateDensity;
  presentation?: ResumePresentationSettings;
  className?: string;
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
            {displayedDocument.contact.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
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
              <div className="professional-resume__item" key={item.id}>
                {item.heading && <h3>{item.heading}</h3>}
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
