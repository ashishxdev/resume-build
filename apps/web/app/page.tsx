import Link from "next/link";

import { HomepageHeader } from "@/components/home/homepage-header";
import { SiteBrand } from "@/components/home/site-brand";

const principles = [
  [
    "01",
    "Uses your authentic experience",
    "Every recommendation is grounded in the resume you provide. Your real work stays at the center of every edit.",
    "Evidence-backed suggestions",
  ],
  [
    "02",
    "Shows genuine skill gaps",
    "See what a role asks for, what you already demonstrate, and what is truly missing—without keyword stuffing.",
    "Honest gap analysis",
  ],
  [
    "03",
    "You approve every AI change",
    "Compare each suggestion with your original wording and stay in complete control of the final document.",
    "Human-in-the-loop by design",
  ],
];

const steps = [
  [
    "Upload your baseline",
    "Upload a PDF or DOCX resume to create your verified baseline.",
  ],
  [
    "Paste the job description",
    "We identify role priorities, keywords, and seniority signals.",
  ],
  [
    "See the gaps",
    "Compare your verified experience against the role in seconds.",
  ],
  [
    "Review every change",
    "Accept, reject, or edit each evidence-backed suggestion.",
  ],
  [
    "Export with confidence",
    "Download a polished, ATS-friendly PDF that still sounds like you.",
  ],
];

const faqs = [
  [
    "Will Make My Resume invent experience or metrics?",
    "No. Suggestions must be supported by information in your resume. When a requirement is genuinely missing, we show it as a gap instead of manufacturing a claim.",
  ],
  [
    "Can I review changes before they are applied?",
    "Yes. Every suggestion includes the original text, the proposed revision, and its supporting evidence. Nothing changes until you approve it.",
  ],
  [
    "Does it work with ATS systems?",
    "The editor checks structure, parseability, keyword alignment, and role relevance. The goal is a clear resume—not a document packed with repeated keywords.",
  ],
  [
    "Can I keep different versions for different roles?",
    "Yes. Your original remains protected, while each tailored version keeps its own job context, edits, and history.",
  ],
  [
    "What happens to my uploaded resume?",
    "Your resume is private to your account. Public sharing is opt-in, can be disabled at any time, and never exposes the original file.",
  ],
];

function Check() {
  return (
    <span className="check" aria-hidden="true">
      ✓
    </span>
  );
}

export default function HomePage() {
  return (
    <main>
      <HomepageHeader />

      <section className="hero" id="product">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="hero-badge">
              <span /> Ethical career tech · Zero hallucinations
            </p>
            <h1>
              Tailor your resume to the job. Keep it <em>true to you.</em>
            </h1>
            <p className="hero-lede">
              Make My Resume aligns your authentic accomplishments with target
              job descriptions in minutes. No invented titles, no exaggerated
              metrics, and you approve every single AI suggestion.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/signup">
                Tailor my resume <span aria-hidden="true">→</span>
              </Link>
              <a className="watch-link" href="#how-it-works">
                See how it works <span>▷</span>
              </a>
            </div>
            <div className="trust-row">
              <span>
                <Check /> Free to use
              </span>
              <span>
                <Check /> Evidence-backed tailoring
              </span>
              <span>
                <Check /> 100% human-in-the-loop control
              </span>
            </div>
          </div>
          <div className="hero-demo" aria-label="Resume tailoring preview">
            <div className="demo-window">
              <div className="demo-left">
                <div className="demo-top">
                  <span className="company-mark">S</span>
                  <div>
                    <div className="company-name">
                      <b>Stripe</b>
                      <em>Greenhouse JD</em>
                    </div>
                    <small>Staff Product Designer</small>
                  </div>
                  <span className="score">
                    94<small>%</small>
                    <em>ATS Match</em>
                  </span>
                </div>
                <div className="competencies">
                  <div className="mini-label">
                    <span>Target competency vectors</span>
                  </div>
                  <div className="tags">
                    <span>✓ Design system tokens</span>
                    <span>✓ Cross-functional lead</span>
                    <span>✓ Metric-driven UI</span>
                    <span className="muted-tag">⌘ Multi-brand governance</span>
                  </div>
                  <blockquote>
                    <strong>◎ &nbsp; Core requirement extracted</strong>
                    <p>
                      “...author systemic token architectures across multi-brand
                      surfaces while accelerating cross-functional feature
                      velocity...”
                    </p>
                  </blockquote>
                </div>
                <div className="verified">
                  <span>
                    <Check /> 28 verified citations match
                  </span>
                  <b>0 hallucinations</b>
                </div>
              </div>
              <div className="demo-right">
                <div className="candidate">
                  <span>AM</span>
                  <div>
                    <b>Alex Mercer</b>
                    <small>Lead Systems Architect — Linear Platforms</small>
                  </div>
                  <strong>↗ +26% Lift</strong>
                </div>
                <div className="draft-card original-draft">
                  <div>
                    <small>↶ Original uncalibrated draft</small>
                    <em>Generic</em>
                  </div>
                  <p>
                    “Responsible for maintaining component libraries, helping
                    front-end teams ship components faster and improving design
                    handoff across squads.”
                  </p>
                </div>
                <div className="draft-card aligned-draft">
                  <div>
                    <small>✣ Aligned & quantified proposal</small>
                    <em>Strongest ATS Match</em>
                  </div>
                  <p>
                    “Unified <mark>tokenization engine</mark> across 4
                    enterprise products, accelerating cross-functional feature
                    velocity by
                    <strong>34%</strong> through shared semantic tokens.”
                  </p>
                  <span>
                    <Check /> Source-verified from your 2022 GitHub PR archive
                    (#1402)
                  </span>
                </div>
                <div className="decision">
                  <span>⌁ &nbsp; Your decision required</span>
                  <span className="mock-action">× &nbsp; Reject</span>
                  <span className="mock-action approve">
                    ✓ &nbsp; Approve change
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="wash-section" id="integrity">
        <div className="shell">
          <header className="section-heading centered">
            <p className="eyebrow">Our ethical oath</p>
            <h2>Career acceleration with strict integrity.</h2>
            <p>
              AI should illuminate your genuine career brilliance—not
              manufacture fiction that unspools in the interview.
            </p>
          </header>
          <div className="principle-grid">
            {principles.map(([number, title, copy, note]) => (
              <article key={number}>
                <span className="principle-number">{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <footer>
                  <Check /> {note}
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="compare-section">
        <div className="shell">
          <header className="section-heading split">
            <div>
              <p className="eyebrow">Architectural comparison</p>
              <h2>Your experience, calibrated for the opportunity.</h2>
            </div>
            <p>
              See the precise difference between a general resume and a
              role-aligned version—without changing the facts.
            </p>
          </header>
          <div className="document-compare">
            <DocumentCard tailored={false} />
            <div className="bridge">
              <span>→</span>
              <small>
                Grounded
                <br />
                transformation
              </small>
            </div>
            <DocumentCard tailored />
          </div>
        </div>
      </section>

      <section className="wash-section" id="match-and-ats">
        <div className="shell analysis-grid">
          <div>
            <p className="eyebrow">Granular telemetry</p>
            <h2>Know exactly where you stand before you apply.</h2>
            <p className="large-copy">
              Separate the skills you can prove from requirements you have yet
              to demonstrate. Focus your effort where it matters most.
            </p>
            <ul className="benefit-list">
              <li>
                <Check />
                <span>
                  <b>Evidence, not guesses</b>
                  <small>
                    Every match connects to an exact resume passage.
                  </small>
                </span>
              </li>
              <li>
                <Check />
                <span>
                  <b>Priority-weighted gaps</b>
                  <small>Know what is essential and what is optional.</small>
                </span>
              </li>
              <li>
                <Check />
                <span>
                  <b>Seniority calibration</b>
                  <small>
                    Match your narrative to the role’s expected scope.
                  </small>
                </span>
              </li>
            </ul>
          </div>
          <div className="analysis-card">
            <div className="analysis-top">
              <div>
                <span>Candidate analysis</span>
                <h3>Lead Distributed Systems Engineer</h3>
              </div>
              <strong>
                87<small>/100</small>
              </strong>
            </div>
            <div className="meter">
              <i />
            </div>
            <SkillGroup
              label="Verified in your resume"
              items={[
                "Kubernetes",
                "Go",
                "Event-driven systems",
                "Team leadership",
              ]}
            />
            <SkillGroup
              label="Recommended additions"
              items={["Multi-region failover", "FinOps ownership"]}
              amber
            />
            <div className="calibration">
              <div>
                <span>Seniority calibration</span>
                <b>Lead / Staff grade</b>
              </div>
              <div>
                <span>Narrative voice</span>
                <b>Direct & impact-oriented</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="review-section">
        <div className="shell">
          <header className="section-heading centered">
            <p className="eyebrow">Interactive human-in-the-loop</p>
            <h2>Review the reasoning, not just the rewrite.</h2>
            <p>
              Each suggestion includes the source, the proposed edit, and a
              plain-language explanation of why it helps.
            </p>
          </header>
          <div className="suggestions">
            <Suggestion
              number="01"
              type="Impact quantification"
              title="Surface the verified result"
              old="Led the redesign of account onboarding."
              next="Led the redesign of account onboarding, reducing time-to-value by 26%."
              source="26% is verified in your supplied project notes."
            />
            <Suggestion
              number="02"
              type="Keyword standardization"
              title="Use the employer’s language naturally"
              old="Built a reusable library for product teams."
              next="Built a reusable design system adopted across four product teams."
              source="Product count is supported by your experience section."
            />
          </div>
        </div>
      </section>

      <section className="wash-section studio-section">
        <div className="shell studio-grid">
          <div>
            <p className="eyebrow">The crafting studio</p>
            <h2>Edit with context. Preview with confidence.</h2>
            <p className="large-copy">
              Your structured resume and polished preview stay side by side.
              Edit content without fighting document formatting.
            </p>
            <div className="studio-stats">
              <div>
                <b>18</b>
                <span>Skills parsed</span>
              </div>
              <div>
                <b>4</b>
                <span>Roles verified</span>
              </div>
              <div>
                <b>94%</b>
                <span>ATS alignment</span>
              </div>
            </div>
          </div>
          <div className="editor">
            <nav>
              <span className="active">Candidate</span>
              <span>Summary</span>
              <span>Experience</span>
              <span>Skills</span>
              <span>Education</span>
            </nav>
            <div className="fields">
              <label>
                Candidate information
                <input readOnly value="Alex Mercer · SF Bay Area" />
              </label>
              <label>
                Executive summary
                <textarea
                  readOnly
                  value="Design systems leader building clear, accessible product foundations at scale."
                />
              </label>
              <label>
                Experience
                <span className="mock-control">4 roles organized</span>
              </label>
              <label>
                Core competencies
                <span className="mock-control">18 skills categorized</span>
              </label>
            </div>
            <div className="paper">
              <header>
                <h3>Alex Mercer</h3>
                <p>Staff Product Designer & Design Systems Architect</p>
              </header>
              <h4>Executive summary</h4>
              <p>
                Design leader translating complex platform needs into coherent
                systems.
              </p>
              <h4>Selected experience</h4>
              <b>Linear Platform · Design Systems Lead</b>
              <ul>
                <li>
                  Unified cross-platform tokens, reducing redundant UI code by
                  34%.
                </li>
                <li>Mentored 11 designers across four product squads.</li>
              </ul>
              <h4>Core skills</h4>
              <div>
                <span>Design systems</span>
                <span>Accessibility</span>
                <span>Strategy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="audit-section">
        <div className="shell audit-grid">
          <div>
            <p className="eyebrow">Deterministic audit</p>
            <h2>More than a vague “ATS score.”</h2>
            <p className="large-copy">
              Understand the checks behind your result, from parser readability
              to role relevance.
            </p>
          </div>
          <div className="audit-cards">
            <Audit
              score="92"
              title="Keyword density"
              copy="High organic frequency without keyword stuffing."
            />
            <Audit
              score="100"
              title="Parseability"
              copy="Clear hierarchy with no parser bottlenecks."
            />
            <Audit
              score="88"
              title="Impact clarity"
              copy="Strong active verbs and measurable outcomes."
            />
            <Audit
              score="94"
              title="Relevance index"
              copy="Aligned to the target role’s scope."
            />
          </div>
        </div>
      </section>

      <section className="versions-section">
        <div className="shell versions-grid">
          <div className="version-list">
            <Version
              title="Tailored for Figma"
              copy="Lead Product Architect · Modified 2 hours ago"
              score="96%"
              selected
            />
            <Version
              title="Tailored for Stripe"
              copy="Staff Product Designer · Modified yesterday"
              score="94%"
            />
            <Version
              title="Original base resume"
              copy="Uploaded Oct 12 · Protected baseline"
              score="Master"
            />
          </div>
          <div>
            <p className="eyebrow">Version lineage</p>
            <h2>
              One career history. A precise version for every opportunity.
            </h2>
            <p className="large-copy">
              Keep your original protected, compare changes, restore earlier
              drafts, and export the right version for each application.
            </p>
            <div className="action-row">
              <Link className="button" href="/signup">
                Create my first version
              </Link>
              <a className="watch-link" href="#how-it-works">
                Explore the workflow
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="workflow-section" id="how-it-works">
        <div className="shell">
          <header className="section-heading centered">
            <p className="eyebrow">The workflow</p>
            <h2>From baseline to application-ready.</h2>
            <p>Five clear steps. No black box, no silent rewrites.</p>
          </header>
          <ol className="steps">
            {steps.map(([title, copy], index) => (
              <li key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="shell faq-shell">
          <header className="section-heading centered">
            <p className="eyebrow">Clarity & answers</p>
            <h2>Questions before you begin.</h2>
          </header>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell cta-panel">
          <div>
            <p className="eyebrow light">Your experience is already valuable</p>
            <h2>Make sure the right employer can see it.</h2>
            <p>
              Build a role-aligned resume that is clearer, stronger, and still
              entirely yours.
            </p>
          </div>
          <div>
            <Link className="button light-button" href="/signup">
              Tailor my resume
            </Link>
            <small>Free to use · You approve every change</small>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <SiteBrand />
            <p>
              Evidence-based resume tailoring for ambitious professionals who
              refuse to compromise their integrity.
            </p>
            <span>
              <Check /> Ethical resume guarantee
            </span>
          </div>
          <FooterLinks
            title="Product"
            links={[
              ["Resume tailoring", "/#product"],
              ["ATS analysis", "/#match-and-ats"],
              ["How it works", "/#how-it-works"],
            ]}
          />
          <FooterLinks
            title="Company"
            links={[
              ["FAQ", "/#faq"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
              ["Security", "/#integrity"],
            ]}
          />
          <div className="pledge">
            <h3>Our commitment</h3>
            <p>
              “Never fabricate experience. Refine and surface genuine
              professional depth.”
            </p>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>© 2026 Make My Resume. All rights reserved.</span>
          <span>Built for honest career growth.</span>
        </div>
      </footer>
    </main>
  );
}

function DocumentCard({ tailored }: { tailored: boolean }) {
  return (
    <article className={`document ${tailored ? "tailored" : ""}`}>
      <header>
        <div>
          <span>{tailored ? "Tailored variant" : "Original baseline"}</span>
          <b>{tailored ? "Vercel_Optimized.pdf" : "Standard Resume.pdf"}</b>
        </div>
        <em>{tailored ? "94% match" : "General"}</em>
      </header>
      <div className="doc-lines">
        <b />
        <i />
        <i />
        <i />
      </div>
      <div className="finding">
        <span>01</span>
        <div>
          <b>
            {tailored
              ? "True-to-you quantified impact"
              : "Core impact is buried"}
          </b>
          <p>
            {tailored
              ? "Verified outcomes move to the foreground while your voice stays intact."
              : "Strong experience exists, but its result and scope are difficult to scan."}
          </p>
        </div>
      </div>
      <div className="finding">
        <span>02</span>
        <div>
          <b>
            {tailored ? "ATS keyword cohesion" : "Keywords are uncalibrated"}
          </b>
          <p>
            {tailored
              ? "Role language is integrated naturally, never repeated for scoring alone."
              : "Relevant language is present without matching the role’s emphasis."}
          </p>
        </div>
      </div>
    </article>
  );
}

function SkillGroup({
  label,
  items,
  amber = false,
}: {
  label: string;
  items: string[];
  amber?: boolean;
}) {
  return (
    <div className="skill-group">
      <span>{label}</span>
      <div className={amber ? "amber" : ""}>
        {items.map((item) => (
          <b key={item}>{item}</b>
        ))}
      </div>
    </div>
  );
}

function Suggestion({
  number,
  type,
  title,
  old,
  next,
  source,
}: {
  number: string;
  type: string;
  title: string;
  old: string;
  next: string;
  source: string;
}) {
  return (
    <article className="suggestion">
      <span className="suggestion-number">{number}</span>
      <div>
        <small>{type}</small>
        <h3>{title}</h3>
        <div className="text-diff">
          <div>
            <span>Original</span>
            <p>{old}</p>
          </div>
          <div>
            <span>Suggested</span>
            <p>{next}</p>
          </div>
        </div>
        <p className="source">
          <Check /> {source}
        </p>
      </div>
      <aside>
        <span>Reject</span>
        <span>Accept</span>
      </aside>
    </article>
  );
}

function Audit({
  score,
  title,
  copy,
}: {
  score: string;
  title: string;
  copy: string;
}) {
  return (
    <article>
      <span>{score}</span>
      <div>
        <b>{title}</b>
        <p>{copy}</p>
      </div>
    </article>
  );
}

function Version({
  title,
  copy,
  score,
  selected = false,
}: {
  title: string;
  copy: string;
  score: string;
  selected?: boolean;
}) {
  return (
    <article className={selected ? "selected" : ""}>
      <div>
        <i />
        <span>
          <b>{title}</b>
          <small>{copy}</small>
        </span>
      </div>
      <strong>{score}</strong>
    </article>
  );
}

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: Array<readonly [label: string, href: string]>;
}) {
  return (
    <div className="footer-links">
      <h3>{title}</h3>
      {links.map(([label, href]) => (
        <Link href={href} key={label}>
          {label}
        </Link>
      ))}
    </div>
  );
}
