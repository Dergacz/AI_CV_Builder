---
change_id: google-consent-notice
title: Replace the Google-button consent checkbox with an inline consent notice
status: implemented
created: 2026-08-12
updated: 2026-08-14
archived_at: null
---

## Notes

Replace the consent checkbox next to the Google button with an inline notice saying that continuing with Google accepts the Terms and Privacy Policy, with links to `/terms` and `/privacy`. The consent cookie is set for both intents, and the callback stamps `consent_version` as before. This also removes the dead end where a new user clicks Google on `/auth/signin` and, after OAuth, is sent to `/auth/signup?error=consent_required`.
