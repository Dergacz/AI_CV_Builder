# Code Review Agent Test Fixtures

Seven `git diff` files plus adjacent `.expected.md` files are the basis for assertions.

| Fixture | Contents | Criterion from `context/review-criteria.md` |
| ------- | -------- | ------------------------------------------- |
| `01-filename-cap-byte-claim` | Looks clean: the comment promises 255-byte safety while truncation is by characters | 5. Layering, duplication and cost of reading |
| `02-zod-migration-drift` | zod raises the comment limit while the migration check constraint does not | 1. Contract synchrony |
| `03-cv-tags-missing-rls` | New `cv_tags` table without RLS and policies | 4. Proven access boundary |
| `04-vacuous-generate-test` | Test asserts its own mock and `toBeDefined()` | 3. Tests that can fail |
| `05-prompt-warning-code-drift` | Prompt emits `date_gaps`, but the zod enum does not know it and the fixture is not updated | 1 + 3 |
| `06-salvage-partial-draft` | Invalid draft salvage instead of an honest error, disguised as a UX fix | 2. Honest failure |
| `07-clean-cv-notes-table` | Actually clean PR: new table with RLS, policies, and pgTAP evidence | - (expects no findings) |

## Feeding Fixtures to the Agent

Each file starts with a `Subject:` / `Description:` block. Those are the PR title and body,
matching the input described in `context/changes/ci-cd-code-review/requirements.md`.

**Everything after `--- FIXTURE METADATA (strip before feeding the agent) ---` must be
removed before sending the fixture to the agent.** That block contains the answer: which
criterion is violated. The marker is present in every file, including the clean one, so
the mere presence of metadata cannot reveal the expected outcome.

```sh
sed '/^--- FIXTURE METADATA/,$d' evals/fixtures/02-zod-migration-drift.diff
```

## Caveats

- The diffs are review inputs, not patches for `git apply`: `index` hashes are invented,
  line numbers are approximate, and the preamble plus footer would break patch application.
- Fixtures 02, 03, and 05 require context outside the diff: the current migration,
  neighboring tables, the zod enum, and test fixture contents. If the agent receives only
  title, description, and diff, it will not catch them. That is an intentional test of
  whether this input is sufficient.
- All resumes and names in examples are invented; there is no personal data.

## Which Fixture Is Clean

Fixture **07** is the clean one, not 01. Until 2026-08-27, fixture 01 played that role, but
its diff contains a real defect: a comment promises safety against a 255-byte filename
limit that character-based truncation does not guarantee. In the 2026-08-27 run, opus-4.8
found it and was counted as failing, which meant the suite punished the attentive model.
Fixture 01 is now classified as "looks clean, but is not"; fixture 07 protects against
false positives.
