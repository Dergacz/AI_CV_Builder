// Bumped for S-08: the privacy policy gained a substantive deletion section (what erasure removes,
// that it is immediate and unrecoverable, and why residual analytics events are unlinkable). A
// displayed "policy version" that does not move when the terms move is a version stamp that means
// nothing.
//
// This is a record, not a gate: `consent_version` in user metadata captures WHICH version a user
// accepted, and nothing in the app compares it against this constant, so bumping it does not
// re-prompt existing accounts. New signups stamp the new version; existing accounts keep the one
// they actually accepted.
export const POLICY_VERSION = "2026-08-09";
export const POLICY_LAST_UPDATED = POLICY_VERSION;
