#!/usr/bin/env bash
# PostToolUse(Write|Edit) hook: run only the tests RELATED to the edited file
# (via the module graph), and only when that file lives in the highest-risk area:
# the server-authoritative business layer — src/lib/services/** and src/pages/api/**.
#
# Risk-area rationale (see context/foundation discovery): services hold the most
# business logic (cv-generation 303 LOC, cv-repository, entitlements), and the API
# routes own the unbypassable Advanced/Basic gating (FR-003) and owner-only access.
# Edits outside this area (components, copy strings, i18n, config) skip — no tests run.
set -uo pipefail

FILE=$(jq -r '.tool_input.file_path // empty')
[ -n "$FILE" ] && [ -f "$FILE" ] || exit 0

# Make the path repo-relative so the risk-area gate and vitest agree.
REL="${FILE#"$CLAUDE_PROJECT_DIR"/}"

# Only TypeScript sources; never trigger on test files themselves.
case "$REL" in
  *.test.ts) exit 0 ;;
  *.ts) ;;
  *) exit 0 ;;
esac

# Risk-area gate: bash `case` `*` matches across '/', so these cover nested paths.
case "$REL" in
  src/lib/services/*) ;;
  src/pages/api/*) ;;
  *) exit 0 ;;   # outside the risk area → do not run tests
esac

# vitest `related` runs only tests whose module graph reaches REL; it exits 0 with
# "No test files found" when nothing relates (fast, no false alarm). AI_AGENT=1 gives
# compact output on Vitest 4.1+.
OUT=$(cd "$CLAUDE_PROJECT_DIR" && AI_AGENT=1 npx vitest related "$REL" --run 2>&1)
STATUS=$?
[ $STATUS -eq 0 ] && exit 0

# Block and feed the failing-test output back to the agent (truncated under the 10k cap).
OUT=$(printf '%s' "$OUT" | tail -c 8000)
jq -n --arg out "$OUT" \
  '{decision:"block", reason:("Related tests failed for the risk-area file you just edited:\n\n"+$out)}'
exit 0
