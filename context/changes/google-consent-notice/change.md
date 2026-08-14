---
change_id: google-consent-notice
title: Replace the Google-button consent checkbox with an inline consent notice
status: implemented
created: 2026-08-12
updated: 2026-08-14
archived_at: null
---

## Notes

заменить чекбокс согласия у Google-кнопки на строку-нотис «Продолжая через Google, вы принимаете Условия и Политику конфиденциальности» со ссылками на /terms и /privacy; consent-кука ставится для обоих intent'ов, callback штампует consent_version как раньше — это заодно убирает тупик, когда новый пользователь жмёт Google на /auth/signin и после OAuth его выкидывает на /auth/signup?error=consent_required
