# 01 - Looks Clean, But Is Not

The diff is easy to trust: a tidy helper function, no contract changes, and tests for
boundaries such as exactly 80, more than 80, a dangling hyphen, and multibyte characters.
That is why the fixture exists in this form: the defect is hidden in the claim about the
code, not in the code path itself.

## What Is Actually Wrong

The comment added by the same PR says:

> The stem is capped at `MAX_STEM_LENGTH` characters so the download name stays well
> inside the 255-byte filename limit common filesystems enforce

But `truncateStem` truncates by `stem.length`, which means UTF-16 characters, not bytes.
The difference is invisible for plain Latin text, but 80 Cyrillic characters are about
160 bytes, and 80 CJK characters or emoji can reach about 320 bytes, beyond 255. The PR's
own test (`caps by characters, not bytes, for multi-byte titles`) explicitly locks in that
semantics, so the behavior is intentional and the comment is the false part.

The defect is not character-based truncation. That can be a valid choice. The defect is
that the nearby comment promises a guarantee that choice does not provide, and future
maintainers may rely on it.

## Criterion

5. Layering, duplication and cost of reading. The score-10 rubric requires non-obvious
decisions to be documented at the choice point. A comment that promises something the code
does not do is the same defect in reverse.

## Expectation

One finding on `src/lib/cv-export-filename.ts`, connecting the 255-byte guarantee to
character-based truncation. Severity should be `minor` or `nit`: this is a wrong comment,
not broken behavior, and `request-changes` would be disproportionate.

Candidate wording: "byte", "255", "character", "multi-byte", "UTF-8".

## History

Before 2026-08-27, this fixture was named `01-clean-filename-length-cap` and expected no
findings. In the 2026-08-27 run, opus-4.8 found this mismatch and was counted as failing,
so the suite punished an attentive model and rewarded inattentive ones. Fixture 07 now
plays the role of the truly clean PR.
