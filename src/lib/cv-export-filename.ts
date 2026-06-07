/**
 * Builds the download filename for an exported CV PDF — pure, zod-free, client-safe.
 *
 * Prefers the saved CV title, falls back to the person's full name, then a bare
 * `"cv"`. Unicode letters/digits are preserved (so a Cyrillic or Polish title stays
 * meaningful) while whitespace and punctuation collapse to single hyphens.
 */

const PDF_EXTENSION = ".pdf";
const FALLBACK_STEM = "cv";

/**
 * Slugify a label: lowercase, keep Unicode letters/digits, collapse every run of
 * non-letter/digit characters to a single hyphen, and trim leading/trailing hyphens.
 * Returns an empty string when nothing usable remains.
 */
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive a safe, meaningful `<stem>.pdf` filename from the CV title or full name,
 * falling back to `cv.pdf` when neither yields a usable slug.
 */
export function buildCvPdfFilename(input: { title?: string; fullName?: string }): string {
  const stem = slugify(input.title ?? "") || slugify(input.fullName ?? "") || FALLBACK_STEM;
  return `${stem}${PDF_EXTENSION}`;
}
