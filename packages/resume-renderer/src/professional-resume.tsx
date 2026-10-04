import type {
  ProfessionalResumeDocument,
  ResumeTemplateDensity,
} from "@make-my-resume/contracts";

export interface ProfessionalResumeProps {
  document: ProfessionalResumeDocument;
  density?: ResumeTemplateDensity;
  className?: string;
}

export function ProfessionalResume({
  document,
  density = "comfortable",
  className,
}: ProfessionalResumeProps) {
  return (
    <article
      className={["professional-resume", className].filter(Boolean).join(" ")}
      data-density={density}
      data-resume-renderer="professional-ats"
    >
      <header className="professional-resume__header">
        <h1>{document.name}</h1>
        {document.headline && <p>{document.headline}</p>}
        {document.contact.length > 0 && (
          <ul aria-label="Contact information">
            {document.contact.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </header>

      {document.sections.map((section) => (
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
