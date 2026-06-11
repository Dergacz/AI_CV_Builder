import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement } from "react";

import { Font, renderToBuffer } from "@react-pdf/renderer";
import { afterAll, describe, expect, it } from "vitest";

import CvPdfDocument from "@/components/cv/CvPdfDocument";
import { generatedCvDraftSchema, type GeneratedCvDraft } from "@/lib/cv-draft";
import { getCvEditorCopy } from "@/lib/cv-editor-copy";
import { cvOutputLanguages, type CvOutputLanguage } from "@/lib/cv-questionnaire";

/**
 * PDF output-quality characterization (F-02, plan phase 3).
 *
 * Two layers over CvPdfDocument: (1) a font-free render-tree walk asserting every
 * section's content and language-driven headings + empty-state branches, and (2) a
 * bytes smoke that a valid, non-trivial PDF is produced. Closes the explicit F-02
 * "no PDF export-quality regression" gap.
 *
 * Break-to-prove-red (verified, then reverted): removing the skills <Section> from
 * CvPdfDocument (or swapping a heading's copy source) turns the
 * "section headings follow the CV output language" / content tests red.
 *
 * Font note: CvPdfDocument registers Noto Sans at import time from the browser path
 * `/fonts/...`, which node cannot resolve. The bytes smoke calls Font.clear() and
 * re-registers from the on-disk public/fonts before rendering; the render-tree layer
 * needs no fonts.
 */

const fixtureDraft = generatedCvDraftSchema.parse(
  JSON.parse(readFileSync("context/changes/generation-export-decision-contract/cv-contract.fixture.json", "utf-8")),
);

function draftFor(language: CvOutputLanguage): GeneratedCvDraft {
  return { ...fixtureDraft, language };
}

function emptyDraft(language: CvOutputLanguage): GeneratedCvDraft {
  return {
    ...fixtureDraft,
    language,
    sections: { summary: fixtureDraft.sections.summary, experience: [], education: [], skills: [], languages: [] },
  };
}

interface ReactLike {
  type: unknown;
  props: { children?: unknown } & Record<string, unknown>;
}

function isElement(node: unknown): node is ReactLike {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

/**
 * Walk the @react-pdf element tree, invoking function components (Section, CvPdfDocument)
 * and recursing host primitives (whose `type` is a string), collecting text leaves.
 */
function collectText(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    if (node.trim().length > 0) out.push(node);
    return;
  }
  if (typeof node === "number") {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (!isElement(node)) return;
  if (typeof node.type === "function") {
    const render = node.type as (props: Record<string, unknown>) => unknown;
    collectText(render(node.props), out);
    return;
  }
  collectText(node.props.children, out);
}

function renderText(draft: GeneratedCvDraft, outputLanguage: CvOutputLanguage, fullName?: string): string {
  const out: string[] = [];
  collectText(createElement(CvPdfDocument, { draft, fullName, outputLanguage }), out);
  return out.join("\n");
}

describe("CvPdfDocument — render-tree content", () => {
  it("renders the full name and every section's content", () => {
    const text = renderText(draftFor("en"), "en", "Ada Lovelace");

    expect(text).toContain("Ada Lovelace");
    expect(text).toContain(fixtureDraft.sections.summary.body);
    expect(text).toContain("Volunteer event assistant");
    expect(text).toContain("Community career fair");
    expect(text).toContain("Local secondary school");
    expect(text).toContain("Core skills");
    expect(text).toContain("Polish");
  });

  it("drives section headings from the CV output language, not the interface locale", () => {
    for (const language of cvOutputLanguages) {
      const text = renderText(draftFor(language), language);
      const sections = getCvEditorCopy(language).sections;
      expect(text).toContain(sections.summary);
      expect(text).toContain(sections.experience);
      expect(text).toContain(sections.education);
      expect(text).toContain(sections.skills);
      expect(text).toContain(sections.languages);
    }
    // Spot-check a non-Latin heading to guard the language wiring concretely.
    expect(renderText(draftFor("ru"), "ru")).toContain("Резюме");
  });

  it("renders the empty-state copy for each empty section", () => {
    for (const language of cvOutputLanguages) {
      const text = renderText(emptyDraft(language), language);
      const empty = getCvEditorCopy(language).emptyStates;
      expect(text).toContain(empty.experience);
      expect(text).toContain(empty.education);
      expect(text).toContain(empty.skills);
      expect(text).toContain(empty.languages);
    }
  });
});

describe("CvPdfDocument — bytes smoke", () => {
  afterAll(() => {
    Font.clear();
  });

  it("renders to a valid, non-trivial PDF buffer", async () => {
    // The import-time registration points Noto Sans at the unresolvable `/fonts/...`
    // browser path, and Font.register appends rather than overwrites — so clear the
    // registry and re-register from on-disk fonts. Helvetica (react-pdf's internal
    // layout fallback) is dropped by clear(), so alias it to the same file.
    const regular = resolve("public/fonts/NotoSans-Regular.ttf");
    Font.clear();
    Font.register({
      family: "Noto Sans",
      fonts: [{ src: regular }, { src: resolve("public/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" }],
    });
    Font.register({ family: "Helvetica", src: regular });

    // CvPdfDocument renders a <Document> internally; cast to the element type renderToBuffer
    // expects, mirroring the production cast in useCvExport.ts.
    const element = createElement(CvPdfDocument, {
      draft: draftFor("ru"),
      fullName: "Ада Лавлейс",
      outputLanguage: "ru",
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(element);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
