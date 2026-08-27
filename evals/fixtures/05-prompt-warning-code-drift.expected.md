# 05 — промпт изменён, контракт и фикстуры — нет

Ревьюер обязан заметить: промпт и JSON Schema для strict mode теперь разрешают код `date_gaps`,
а `draftWarningCodeSchema` в `src/lib/cv-draft.ts` его не знает — модель вернёт валидный по strict
mode ответ, `generatedCvDraftSchema.safeParse` его отвергнет, и генерация свалится в
`schemaMismatch` → `generation_failed`. Отказ **недетерминированный**: ломается только у людей с
разрывом в опыте, то есть ровно у целевой аудитории фичи.

Тестовая фикстура `buildModelContent()` в `cv-generation.test.ts` не обновлена и `date_gaps`
никогда не эмитит, поэтому весь набор остаётся зелёным и дефект уезжает в прод.
