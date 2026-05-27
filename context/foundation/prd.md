---
project: AI CV Builder
version: 1
status: draft
created: 2026-05-27
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-01
  after_hours_only: true
---

# AI CV Builder PRD

## Vision & Problem Statement

Ordinary people who need a CV often get stuck at the blank-page moment because they do not know what sections to include, what to write about themselves, or how to make the result look professional.

AI CV Builder helps first-time or low-confidence CV creators get past decision paralysis by turning guided self-description into a structured, professional CV.

## User & Persona

Primary persona: individuals across many orgs, especially job seekers, students, career changers, and first-time workers who need a CV and are not confident starting from an empty page.

## Success Criteria

### Primary

- User starts with no CV, completes the AI-guided questionnaire, receives a complete professional-looking CV in one clean template, makes simple section-based edits to the generated CV content, exports it as PDF, and has it saved to their account.

### Secondary

- Users complete the questionnaire without abandoning the flow.

### Guardrails

- Simplicity must not break: the product must not feel like a complicated document editor.
- Export quality must not break: the generated PDF must always look clean, readable, and professional.
- AI generation should remain fast enough that users do not lose confidence during the wait.

## User Stories

### US-01: Blank-page user creates and exports a CV

- **Given** a user with little or no experience creating professional CVs and no existing resume
- **When** the user completes the AI-guided questionnaire and reviews the generated content
- **Then** the user receives a professional-looking CV, can make simple section-based edits, and exports the final version as a PDF.

## Functional Requirements

- FR-001: Visitor can understand the core value proposition on the landing page. Priority: must-have
  > Socrates: Counter-argument considered: "Landing copy may oversimplify and attract users who expect magic instead of giving useful input." Resolution: kept; the landing page should avoid "magic AI" messaging and explain that AI transforms user answers into a professional CV rather than inventing an entire career automatically.
- FR-002: Visitor can start CV creation from the landing page. Priority: must-have
  > Socrates: Counter-argument considered: "No counter-argument; it stands as written." Resolution: kept; the main goal is reducing friction and getting users into the core flow quickly.
- FR-003: User can sign up and log in with email/password. Priority: must-have
  > Socrates: Counter-argument considered: "Auth adds friction before the user has seen value." Resolution: kept; saving CVs and returning later are core MVP requirements, and simpler persistence is worth the tradeoff for v1.
- FR-004: User can create a new CV from scratch using an AI-guided flow. Priority: must-have
  > Socrates: Counter-argument considered: "From scratch may fail users who already have scattered notes or an old CV." Resolution: kept for MVP; imports and uploads would expand scope, while "from scratch" aligns with the beginner persona.
- FR-005: User can answer a guided questionnaire written in simple, non-CV language. Priority: must-have
  > Socrates: Counter-argument considered: "Over-simplifying questions may produce generic CVs." Resolution: kept; questions should stay simple without becoming generic, and the flow must collect enough structured information to produce meaningful CV content.
- FR-006: The system can generate a complete structured CV based on the questionnaire answers. Priority: must-have
  > Socrates: Counter-argument considered: "Complete may overpromise when the user provides minimal input." Resolution: kept with clarified intent; "complete CV" means a usable professional draft, not a perfect final output from almost no information.
- FR-007: User can view the generated CV in a clean professional template. Priority: must-have
  > Socrates: Counter-argument considered: "One template may not fit different industries or seniority levels." Resolution: kept; one template is an acceptable MVP limitation because template variety is less important than validating the AI-assisted workflow.
- FR-008: User can edit specific CV sections including Summary, Experience, Education, Skills, and Languages. Priority: must-have
  > Socrates: Counter-argument considered: "Section editing may become a hidden document editor and expand scope." Resolution: kept with a strict boundary; section editing must stay intentionally simple and avoid turning the product into a full document editor.
- FR-009: User can save changes to the CV. Priority: must-have
  > Socrates: Counter-argument considered: "Autosave/save states can create user confusion if not handled carefully." Resolution: kept; save behavior should be clear and predictable, ideally using simple autosave or explicit save feedback.
- FR-010: User can export the generated CV as PDF. Priority: must-have
  > Socrates: Counter-argument considered: "No counter-argument; it stands as written." Resolution: kept; PDF export is core to real-world usefulness and many users will not perceive the CV as complete without it.
- FR-011: User can access previously created CVs from their account. Priority: must-have
  > Socrates: Counter-argument considered: "A CV dashboard may distract from the first successful CV creation flow." Resolution: kept with a scope limit; the dashboard should stay minimal and focused only on returning to existing CVs.
- FR-012: The system can handle incomplete or minimal user input and still generate a usable CV draft. Priority: must-have
  > Socrates: Counter-argument considered: "A usable draft from minimal input may require assumptions the user does not trust." Resolution: kept; generated content should remain editable and transparent to maintain trust when assumptions are made.
- FR-013: The system provides clear loading/progress feedback during AI generation. Priority: must-have
  > Socrates: Counter-argument considered: "Building rich progress states may cost time better spent making generation faster." Resolution: kept with a simple implementation boundary; MVP should use simple loading/progress states, not complex fake progress systems.
- FR-014: The system shows clear error states if generation or export fails. Priority: must-have
  > Socrates: Counter-argument considered: "Handling many failure modes may expand scope before the happy path is proven." Resolution: kept with a limited scope; MVP needs simple, human-friendly error handling for major failure cases, not exhaustive technical recovery flows.
- FR-015: User can switch the application interface language between English, Polish, and Russian. Priority: must-have
  > Socrates: Counter-argument considered: "Multilingual UI may expand scope into deep localization and slow down the MVP." Resolution: kept with a strict boundary; the MVP needs a lightweight interface translation layer for usability and accessibility, not country-specific localization.

## Non-Functional Requirements

- Privacy: CV data and questionnaire answers are accessible only to the authenticated owner.
- CV output language support: users can create and export CVs in English, Polish, and Russian.
- Interface language support: users can switch the application interface between English, Polish, and Russian through a lightweight i18n layer.
- Export reliability: PDF export produces a readable, correctly formatted CV from the selected template.
- Response timing: typical CV generation completes in under 30 seconds.
- Simplicity: the main flow remains understandable for non-technical users without CV-writing knowledge.
- Browser support: the app works in modern Chrome, Safari, Firefox, and Edge on desktop and mobile.
- Accessibility: the core flow is usable with keyboard navigation and readable labels.
- Retention: saved CVs remain persistently available in the user account until explicitly deleted by the user.

## Business Logic

The application transforms simple, non-professional user answers into a structured, professional CV by deciding which information is relevant, how it should be phrased, and how it should be organized into standard resume sections.

It consumes questionnaire answers about work experience, education, skills, tools, languages, career goals, and free-form personal descriptions written in everyday language.

It produces a structured professional CV draft with organized sections such as Summary, Experience, Education, Skills, and Languages.

The user encounters the result after completing the guided questionnaire, when the generated CV is displayed in a professional template for review, section-based editing, saving, and PDF export.

## Access Control

Users log in. The MVP uses a flat user model: every signed-in user can create and manage only their own CVs. No admin/member roles in the MVP.

## Non-Goals

- No old CV upload/import: v1 focuses on the blank-page problem and start-from-scratch flow only.
- No multiple templates or advanced visual customization: the MVP uses one clean professional template.
- No full document editor: no drag-and-drop, layout editing, section reordering, or advanced formatting.
- No per-section AI regeneration: users can manually edit sections, but AI regeneration remains full-CV only in v1.
- No deep localization: the MVP supports English, Polish, and Russian interface text plus multilingual CV generation/export, but does not yet adapt heavily to country-specific, cultural, or industry-specific resume norms.
- No subscription or billing system in MVP: payment features expand product scope and architecture beyond the validation goal.
- No job-description-based CV tailoring in v1: tailoring adds AI complexity beyond the start-from-scratch CV flow.
- No cover letter generation in v1: cover letters are valuable later but outside the core MVP validation goal.

## Open Questions

None.
