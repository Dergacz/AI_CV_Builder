# 02 - zod to Migration Drift

The reviewer must notice that zod now accepts feedback comments up to 2000 characters, but
the check constraint in `supabase/migrations/20260724194333_create_feedback.sql`
(`char_length(comment) <= 1000`) was not changed. A 1001-2000 character comment will pass
validation and fail on database insert, producing a 500 instead of an honest 400.

Required action: add a migration that raises the constraint, regenerate
`src/db/database.types.ts`, and add a boundary test for exactly 1001 characters that goes
through the database rather than stopping at zod.
