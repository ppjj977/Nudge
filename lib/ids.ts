import { customAlphabet } from "nanoid";

// Collision-resistant, URL-safe, sortable-ish ids (SPEC §5: "ULID or nanoid").
// Lowercase alnum keeps ids easy to paste into URLs and logs.
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 21);

export function newId(prefix: string): string {
  return `${prefix}_${nano()}`;
}
