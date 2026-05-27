---
starter_id: 10x-astro-starter
package_manager: npm
project_name: ai-cv-builder
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

AI CV Builder is a 3-week after-hours web MVP with authenticated saved CVs, AI-assisted CV generation, PDF export, and lightweight English/Polish/Russian interface support. The recommended TypeScript-family starter for this product shape is 10x Astro Starter: Astro, React, TypeScript, Supabase, and Cloudflare provide an opinionated full-stack base with auth, database, storage, edge deployment, and explicit schemas already aligned. AI generation, PDF export, and i18n remain app-level implementation work, while payments, realtime, and background jobs stay out of scope for the MVP. GitHub Actions with auto-deploy-on-merge keeps the delivery path simple for a solo build.
