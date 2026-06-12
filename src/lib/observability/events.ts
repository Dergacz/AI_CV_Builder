// The 8 S-01 funnel step events, shared by the server (./index.ts) and client
// (./client.browser.ts) recording contracts. Kept env-free so the client bundle can import the
// names without pulling in `astro:env/server`. The two halves of the funnel are read as linked
// segments: an anonymous segment (landing → signup) keyed by the anon-session id, and an
// identified segment (email confirm → PDF export) keyed by the pseudonymous user id.
export type FunnelEvent =
  | "funnel_landing_viewed"
  | "funnel_signup_completed"
  | "funnel_email_confirmed"
  | "funnel_questionnaire_started"
  | "funnel_questionnaire_completed"
  | "funnel_cv_generated"
  | "funnel_cv_saved"
  | "funnel_pdf_exported";
