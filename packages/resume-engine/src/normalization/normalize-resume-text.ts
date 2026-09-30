export function normalizeResumeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
