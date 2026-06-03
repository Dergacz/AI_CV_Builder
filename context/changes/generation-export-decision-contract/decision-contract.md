# Generation And PDF Export Decision Contract

## Purpose

This contract resolves roadmap item F-01 for AI CV Builder. It defines the minimum generation output, PDF export boundary, timeout behavior, error buckets, and downstream handoff rules needed before planning:

- S-04 generated CV draft,
- S-05 CV template and section editing,
- S-07 PDF export,
- S-08 full saved PDF flow.

It is a decision artifact, not production implementation. It does not add source routes, database schema, AI provider code, PDF UI, background jobs, or a document editor.

## Decision Summary

| Area              | Decision                                                                               | Downstream consumer    |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------- |
| Generation output | Strict structured JSON, not markdown or HTML                                           | S-04, S-05, S-06, S-07 |
| Editable sections | Summary, Experience, Education, Skills, Languages                                      | S-05                   |
| Minimal input     | Generate a usable but honest draft; never invent private facts                         | S-04                   |
| Timeout           | Typical generation target under 30 seconds with hard failure and retry affordance      | S-04                   |
| Error states      | Three user-facing buckets: `generation_failed`, `export_failed`, `service_unavailable` | S-04, S-07             |
| PDF export        | Validate a Workers/browser-compatible path first; external service only as fallback    | S-07                   |
| Language          | Draft and exported CV use the selected output language: `en`, `pl`, or `ru`            | S-08                   |

## GeneratedCvDraft Top-Level Shape

The generation route planned in S-04 must return one `GeneratedCvDraft` JSON object. The object is intentionally small enough to edit section-by-section and export through one template.

```ts
type GeneratedCvDraft = {
  schemaVersion: 1;
  language: "en" | "pl" | "ru";
  source: {
    questionnaireVersion: string;
    generatedAt: string;
    modelProvider?: string;
    modelName?: string;
  };
  sections: {
    summary: SummarySection;
    experience: ExperienceItem[];
    education: EducationItem[];
    skills: SkillGroup[];
    languages: LanguageItem[];
  };
  assumptions: DraftAssumption[];
  warnings: DraftWarning[];
};
```

### Field Rules

- `schemaVersion` is required and starts at `1`.
- `language` is required and must match the user's selected CV output language.
- `source.questionnaireVersion` is required so S-04 can detect stale questionnaire/contract pairs.
- `source.generatedAt` is required and must be an ISO timestamp.
- `source.modelProvider` and `source.modelName` are optional metadata, not user-facing content.
- `sections` is required and always contains all five editable section keys.
- `assumptions` is required and may be an empty array.
- `warnings` is required and may be an empty array.

## Editable Sections

### Summary

```ts
type SummarySection = {
  headline?: string;
  body: string;
};
```

- `body` is required.
- `headline` is optional and should be short enough for the single CV template.
- The summary must not invent seniority, titles, industries, or career goals not supported by questionnaire answers.

### Experience

```ts
type ExperienceItem = {
  role?: string;
  organization?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description: string;
  highlights: string[];
};
```

- `description` is required.
- `highlights` is required and may be empty.
- `role`, `organization`, `location`, dates, and `isCurrent` are optional because first-time users may not have formal work history.
- Dates use a plain human-readable value until a persistence contract requires a stricter date shape.
- The generator must not invent employers, job titles, dates, employment status, achievements, metrics, or locations.

### Education

```ts
type EducationItem = {
  institution?: string;
  program?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};
```

- All fields are optional because some users may provide incomplete education details.
- The generator may rephrase provided education information, but must not invent schools, degrees, programs, dates, grades, or certificates.
- If education is absent, return an empty `education` array and add a warning rather than fabricating an entry.

### Skills

```ts
type SkillGroup = {
  label: string;
  items: string[];
};
```

- `label` is required.
- `items` is required and must contain at least one skill if the group exists.
- Group labels should stay simple for the MVP, for example `Core skills`, `Tools`, or `Soft skills`.
- The generator may normalize wording, but must not add tools, technologies, or skills not supported by the user's answers.

### Languages

```ts
type LanguageItem = {
  name: string;
  proficiency?: string;
};
```

- `name` is required.
- `proficiency` is optional.
- The generator must not invent language knowledge or proficiency.
- The selected CV output language is not automatically a claimed user language unless the questionnaire supports it.

## Supporting Metadata

```ts
type DraftAssumption = {
  field: string;
  reason: string;
};

type DraftWarning = {
  code:
    | "minimal_input"
    | "missing_experience"
    | "missing_education"
    | "missing_skills"
    | "missing_languages"
    | "low_confidence";
  message: string;
};
```

- `assumptions` records non-factual editorial choices, such as section ordering or phrasing decisions.
- `warnings` records gaps that the UI can surface or use for later editing prompts.
- Warnings should be human-friendly when displayed, but the `code` values stay stable for future slices.

## Minimal-Input Behavior

The generator must produce a usable but honest draft when answers are sparse.

Required behavior:

- Use only facts supplied by the user.
- Rephrase weak or informal answers into professional wording.
- Prefer empty arrays plus warnings over fabricated section entries.
- Preserve uncertainty through `warnings` and `assumptions`.
- Keep the draft editable instead of blocking generation solely because an optional section is incomplete.

Forbidden behavior:

- No invented employers, schools, roles, dates, language proficiency, certifications, achievements, metrics, or private personal details.
- No hidden placeholder facts that look real in the final CV.
- No generic filler that pretends to be user-specific experience.

If input is too thin for a useful summary, return a short conservative summary and add `minimal_input` or `low_confidence` warnings. S-04 can decide whether to prompt for more information, but this contract does not require a follow-up-question flow before first generation.

## Error Buckets

Future generation and export routes should map implementation failures into three user-facing buckets.

| Bucket                | Use when                                                                                  | User-facing behavior                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `generation_failed`   | The CV draft cannot be generated from the submitted questionnaire                         | Show a plain explanation and a retry action                             |
| `export_failed`       | The reviewed CV cannot be converted into a PDF                                            | Keep the edited CV visible and offer retry                              |
| `service_unavailable` | The AI provider, PDF renderer, Supabase, or runtime dependency is temporarily unavailable | Explain that the service is unavailable and ask the user to retry later |

Do not expose provider stack traces, secret names, raw model responses, or internal runtime details in user-facing messages. Technical diagnostics can be added later through server logs or observability, but that is outside F-01.

## Timeout Boundary

Generation has a product target of typical completion under 30 seconds.

Contract rules:

- S-04 should design for a typical successful generation under 30 seconds.
- Long-running requests must fail through `generation_failed` or `service_unavailable`, not hang indefinitely.
- The UI should use simple progress/loading feedback, not fake detailed progress.
- Retry is the MVP recovery affordance.
- F-01 does not introduce queues, background jobs, polling, or durable task orchestration.

PDF export should also have a bounded retry path in S-07. If PDF rendering cannot stay comfortably synchronous for the MVP, S-07 must revisit architecture rather than quietly adding background infrastructure.

## PDF Export Path

The MVP should validate a Workers/browser-compatible PDF path before committing to a dependency.

Primary decision:

- Prefer a browser/client-side PDF renderer or a PDF renderer proven compatible with the Cloudflare Workers runtime.
- Do not treat Node-only APIs, filesystem writes, native binaries, or Chromium-based rendering as compatible with Workers.
- Do not add an external PDF service unless the spike in Phase 2 shows the Workers/browser-compatible path cannot produce a clean, readable CV within MVP constraints.

Fallback trigger:

- Use an external PDF service only if the spike records that browser/client rendering or Workers-compatible rendering fails export quality, modern browser support, or acceptable synchronous runtime behavior.

S-07 must use `pdf-runtime-spike.md` as the source of truth for the final PDF dependency choice.

## Verification Criteria For Downstream Slices

### S-04 Generated CV Draft

S-04 must verify that:

- generation returns `GeneratedCvDraft` with `schemaVersion: 1`,
- all five editable section keys are present,
- sparse input produces warnings instead of fabricated facts,
- generation has simple loading feedback and bounded failure behavior,
- `generation_failed` and `service_unavailable` states are visible to the user.

### S-05 CV Template And Section Editing

S-05 must verify that:

- Summary, Experience, Education, Skills, and Languages are editable as sections,
- edits preserve the same draft shape,
- the UI does not become a full document editor,
- empty arrays or sparse sections remain renderable in the single template.

### S-07 PDF Export

S-07 must verify that:

- export consumes the structured draft shape, not arbitrary HTML from the model,
- the selected PDF path follows the recommendation in `pdf-runtime-spike.md`,
- the generated PDF is readable and correctly formatted in the single template,
- export failures map to `export_failed` or `service_unavailable`,
- the edited CV remains visible if export fails.

### S-08 Full Saved PDF Flow

S-08 must verify that:

- the selected output language is preserved through generation, editing, saving, and export,
- English, Polish, and Russian CV output can use the same structured draft shape,
- the flow remains simple and does not introduce deep localization or country-specific CV rules.

## Out Of Scope

- Production source code.
- Final TypeScript type exports.
- AI provider selection.
- Prompt implementation.
- Final PDF renderer dependency.
- PDF visual QA checklist beyond the contract.
- CV persistence schema.
- Auth or route changes.
- Background jobs, queues, or additional infrastructure.

## Handoff

Future planning should reuse this file instead of re-asking the F-01 roadmap questions. If a future implementation needs to change this contract, it should update this artifact intentionally and call out which downstream slices are affected.

### Downstream Reuse Map

| Slice                                | Reuse these sections                                                                                                                          | Planning note                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| S-04 generated CV draft              | `GeneratedCvDraft Top-Level Shape`, `Editable Sections`, `Supporting Metadata`, `Minimal-Input Behavior`, `Error Buckets`, `Timeout Boundary` | Plan the generation route, loading state, retry behavior, and draft validation against this shape.                  |
| S-05 CV template and section editing | `Editable Sections`, `Supporting Metadata`, `Verification Criteria For Downstream Slices`                                                     | Keep editing section-based and preserve the same draft object; do not add layout editing or section reordering.     |
| S-07 PDF export                      | `PDF Export Path`, `Error Buckets`, `Verification Criteria For Downstream Slices` plus `pdf-runtime-spike.md`                                 | Choose the final PDF dependency from the spike recommendation and export structured draft data, not AI HTML.        |
| S-08 full saved PDF flow             | `GeneratedCvDraft Top-Level Shape`, `PDF Export Path`, `Verification Criteria For Downstream Slices`                                          | Preserve selected output language through generation, editing, saving, and export without adding deep localization. |

### Files To Load First

Future agents planning S-04, S-05, S-07, or S-08 should read these files before asking product questions:

- `context/changes/generation-export-decision-contract/decision-contract.md`
- `context/changes/generation-export-decision-contract/cv-contract.fixture.json`
- `context/changes/generation-export-decision-contract/pdf-runtime-spike.md`
