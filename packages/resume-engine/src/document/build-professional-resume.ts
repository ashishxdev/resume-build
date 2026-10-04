import type {
  ProfessionalResumeDocument,
  ResumeClaim,
  ResumeClaimCategory,
  ResumeDocumentSection,
} from "@make-my-resume/contracts";

const sectionOrder: Exclude<ResumeClaimCategory, "personal_info">[] = [
  "summary",
  "experience",
  "skills",
  "projects",
  "education",
  "certifications",
  "achievements",
  "custom",
];

const sectionTitles: Record<
  Exclude<ResumeClaimCategory, "personal_info">,
  string
> = {
  summary: "Professional Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Achievements",
  custom: "Additional Information",
};

const genericLabels = new Set([
  "summary",
  "professional summary",
  "experience",
  "work experience",
  "professional experience",
  "education",
  "skills",
  "technical skills",
  "projects",
  "certification",
  "certifications",
  "achievement",
  "achievements",
  "personal info",
  "personal information",
  "contact",
  "contact information",
]);

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function personalParts(values: string[]) {
  return unique(
    values.flatMap((value) =>
      value.split(/\r?\n|\s*[|•;]\s*/).map((part) =>
        part
          .replace(/^[-*]\s*/, "")
          .replace(
            /^(?:name|email|phone|mobile|location|address|linkedin|github|website)\s*:\s*/i,
            "",
          )
          .trim(),
      ),
    ),
  );
}

function contactDetails(values: string[]) {
  const text = values.join("\n");
  const emails = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];
  const urls =
    text.match(
      /(?:https?:\/\/|www\.)[^\s,;|]+|(?:linkedin\.com|github\.com)\/[^\s,;|]+/gi,
    ) ?? [];
  const phones =
    text
      .match(/(?:\+?\d[\d ().-]{7,}\d)(?![\d/])/g)
      ?.map((value) => value.trim()) ?? [];
  return unique([...emails, ...phones, ...urls]);
}

function identity(values: string[], contacts: string[]) {
  for (const value of values) {
    const firstLine = value.split(/\r?\n|\s+[|•]\s+/)[0]?.trim() ?? "";
    const withoutContacts = contacts.reduce(
      (candidate, contact) => candidate.replace(contact, ""),
      firstLine,
    );
    const candidate = withoutContacts
      .replace(/^[,;|•\s]+|[,;|•\s]+$/g, "")
      .trim();
    if (
      candidate.length >= 2 &&
      candidate.length <= 160 &&
      !candidate.includes("@") &&
      !/https?:\/\//i.test(candidate) &&
      !/[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(candidate) &&
      !/^\+?[\d ().-]+$/.test(candidate)
    ) {
      return candidate;
    }
  }
  return "Professional Resume";
}

function isUsefulHeading(label: string, body: string) {
  const normalized = label.trim().toLocaleLowerCase("en");
  return (
    !genericLabels.has(normalized) &&
    label.trim().toLocaleLowerCase("en") !== body.trim().toLocaleLowerCase("en")
  );
}

function splitSentences(value: string) {
  const explicitLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (explicitLines.length > 1) return explicitLines;
  return value
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function withoutRepeatedHeading(value: string, heading: string | null) {
  if (!heading) return value.trim();
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .replace(new RegExp(`^${escaped}\\s*(?:[|:-]\\s*)?`, "i"), "")
    .trim();
}

function asBullet(value: string) {
  return /^[-*]\s+/.test(value) ? value : `- ${value}`;
}

function formatSkills(value: string) {
  return value
    .split(/;\s*(?=[A-Za-z][A-Za-z /&+-]{1,40}:)/)
    .map((line) => line.trim().replace(/;$/, ""))
    .filter(Boolean)
    .join("\n");
}

function formatDetailedItem(
  value: string,
  heading: string | null,
  preserveFirstLine: boolean,
) {
  const sentences = splitSentences(withoutRepeatedHeading(value, heading));
  if (sentences.length <= 1) return sentences[0] ?? value.trim();
  const [first, ...remaining] = sentences;
  const firstLooksLikeMetadata =
    preserveFirstLine &&
    (first?.includes("|") ||
      /\b(?:present|19\d{2}|20\d{2})\b/i.test(first ?? ""));
  return [
    ...(firstLooksLikeMetadata && first ? [first] : []),
    ...(!firstLooksLikeMetadata && first ? [asBullet(first)] : []),
    ...remaining.map(asBullet),
  ].join("\n");
}

function experienceLeadMetadata(value: string, heading: string | null) {
  if (!heading) return null;
  const headingMatch = heading.match(/^(.+?)\s+at\s+(.+)$/i);
  if (!headingMatch) return null;
  const [, role, employer] = headingMatch;
  if (!role || !employer) return null;
  const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value
    .trim()
    .match(
      new RegExp(
        `^${escape(role)}\\s*(\\([^)]*\\))?\\s+at\\s+${escape(employer)}\\s*(\\([^)]*\\))?\\.?$`,
        "i",
      ),
    );
  if (!match) return null;
  const metadata = [match[1], match[2]]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.slice(1, -1).trim())
    .filter(Boolean);
  return metadata.length ? metadata.join(" | ") : null;
}

function formatExperience(value: string, heading: string | null) {
  const sentences = splitSentences(value);
  const [first, ...remaining] = sentences;
  const metadata = first ? experienceLeadMetadata(first, heading) : null;
  if (!metadata) return formatDetailedItem(value, heading, true);
  return [metadata, ...remaining.map(asBullet)].join("\n");
}

function formatEducation(value: string, heading: string | null) {
  const remainder = withoutRepeatedHeading(value, heading);
  const datedInstitution = remainder.match(
    /^\(([^)]+)\)\s+(?:at\s+)?(.+?)\.?$/i,
  );
  if (datedInstitution) {
    const [, dates, institution] = datedInstitution;
    return [institution, dates].filter(Boolean).join(" | ");
  }
  return remainder || value.trim();
}

function documentItem(claim: ResumeClaim, tailored: ReadonlySet<string>) {
  let heading = isUsefulHeading(claim.label, claim.value)
    ? claim.label.trim()
    : null;
  let body = claim.value.trim();

  if (claim.category === "skills") body = formatSkills(body);
  if (claim.category === "projects") {
    if (!heading) {
      const candidate = body.split("|")[0]?.trim();
      if (candidate && candidate.length <= 120) heading = candidate;
    }
    body = formatDetailedItem(body, heading, true);
  }
  if (claim.category === "experience") {
    body = formatExperience(body, heading);
  }
  if (claim.category === "education") {
    body = formatEducation(body, heading);
  }

  return {
    id: `item_${claim.id}`,
    sourceClaimId: claim.id,
    heading,
    body,
    tailored: tailored.has(claim.id),
  };
}

export function buildProfessionalResumeDocument(
  claims: ResumeClaim[],
  options: { tailoredClaimIds?: Iterable<string> } = {},
): ProfessionalResumeDocument {
  const ordered = [...claims]
    .filter((claim) => claim.status !== "rejected")
    .sort((left, right) => left.order - right.order);
  const headlineClaim = ordered.find(
    (claim) =>
      claim.category === "personal_info" &&
      /headline|title|role|position/i.test(claim.label),
  );
  const personal = ordered
    .filter(
      (claim) =>
        claim.category === "personal_info" && claim.id !== headlineClaim?.id,
    )
    .map((claim) => claim.value);
  const parts = personalParts(personal);
  const detectedContacts = contactDetails(personal);
  const name = identity(parts.length ? parts : personal, detectedContacts);
  const contacts = unique([
    ...parts.filter((part) => part !== name),
    ...detectedContacts,
  ]);
  const tailored = new Set(options.tailoredClaimIds ?? []);
  const sections: ResumeDocumentSection[] = [];

  for (const category of sectionOrder) {
    const categoryClaims = ordered.filter(
      (claim) => claim.category === category,
    );
    if (!categoryClaims.length) continue;
    sections.push({
      kind: category,
      title: sectionTitles[category],
      items: categoryClaims.map((claim) => documentItem(claim, tailored)),
    });
  }

  return {
    name,
    headline: headlineClaim?.value.trim() ?? null,
    contact: contacts,
    sections,
  };
}
