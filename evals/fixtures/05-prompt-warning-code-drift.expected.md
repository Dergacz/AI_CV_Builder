# 05 - Prompt Changed, Contract and Fixtures Did Not

The reviewer must notice that the prompt and strict-mode JSON Schema now allow the warning
code `date_gaps`, but `draftWarningCodeSchema` in `src/lib/cv-draft.ts` does not know that
code. The model can return a response valid under strict mode, then
`generatedCvDraftSchema.safeParse` rejects it and generation falls into `schemaMismatch`
then `generation_failed`. The failure is **nondeterministic**: it only breaks for users
with experience gaps, exactly the target audience for the feature.

The `buildModelContent()` test fixture in `cv-generation.test.ts` was not updated and never
emits `date_gaps`, so the whole suite stays green while the defect ships.
