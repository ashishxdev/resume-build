import { v7 as uuidv7 } from "uuid";

export type EntityPrefix =
  | "user"
  | "resume"
  | "version"
  | "file"
  | "import"
  | "jd"
  | "tailor"
  | "suggestion"
  | "ats"
  | "share"
  | "job"
  | "lease"
  | "claim";

export function createId(prefix: EntityPrefix): string {
  return `${prefix}_${uuidv7()}`;
}
