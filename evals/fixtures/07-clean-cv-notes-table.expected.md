# 07 - Actually Clean PR

This is the role fixture 01 used to play before 2026-08-27: protection against false
positives. A good reviewer finds **nothing** here and returns `approve` with an empty
finding list.

## Why There Is Nothing to Find

The fixture mirrors 03. There, a new table arrives without RLS. Here, everything criterion
4 requires for a 10 is visible in the diff:

- `alter table public.cv_notes enable row level security` is present;
- policies are granular, per-operation policies, with `with check` on both write paths;
- the pgTAP test does not merely assert that policies exist; it impersonates another user
  and checks zero rows for select, update, and delete, plus a control assertion proving
  that the row existed in the first place;
- owner id comes from `safeGetUser()` in the route, not from the request body or path.

The other four criteria have no hook either:

| Criterion | Why it is satisfied |
| --------- | ------------------- |
| 1. Contract synchrony | The 2000 limit lives in the check constraint, `cv-note.schema.ts` mirrors it, and the migration comment states which side owns the guarantee. `database.types.ts` is regenerated in the same PR. |
| 2. Honest failure | The generation path is not touched. Route errors use existing buckets, without salvage logic. |
| 3. Tests that can fail | Boundaries (exactly 2000, 2001, trim, empty string) are tested against the real schema, without mocks; RLS is proven against the real database. |
| 5. Layering, duplication and cost of reading | The route is thin, database access goes through the repository, `cvSaveErrorMessages`, `readBoundedJson`, and `getCv` are reused, and no new dependency is added. |

## Expectation

`verdict: "approve"`, `findings: []`, and all five scores in the 8-10 range.

## What This Fixture Measures

On August 26, the rule "Never speculate about code you cannot see" was removed from
`REVIEW_INSTRUCTIONS`. It had blocked the agent from catching absences such as a new table
without RLS or a raised limit without a migration. Removing it was correct, but the cost is
the risk of over-inference; before this fixture, that risk was not measured. Any finding
here is evidence of that risk.

Typical false-finding candidates, all invalid: "was `DRAFT_CONTENT_JSON_SCHEMA` updated?"
because notes are not part of the draft shape; "is there an index on `user_id`?" because
`cv_id` is the primary key and reads always use a key pair; "is there a repository test?"
because there is no branch in the repository and the boundary is proven by pgTAP.
