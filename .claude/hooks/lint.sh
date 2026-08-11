#!/usr/bin/env bash
# PostToolUse(Write|Edit) hook: lint the single file the agent just edited.
# Scoped to one file so it stays fast enough for the per-edit layer.
set -uo pipefail

FILE=$(jq -r '.tool_input.file_path // empty')
[ -n "$FILE" ] && [ -f "$FILE" ] || exit 0

case "$FILE" in
  *.ts|*.tsx|*.astro|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

OUT=$(cd "$CLAUDE_PROJECT_DIR" && npx eslint "$FILE" 2>&1)
STATUS=$?
[ $STATUS -eq 0 ] && exit 0

# Block and feed the eslint output back to the agent as additionalContext.
# Truncate to stay under the 10k-char cap.
OUT=$(printf '%s' "$OUT" | tail -c 8000)
jq -n --arg out "$OUT" \
  '{decision:"block", reason:("ESLint found problems in the file you just edited:\n\n"+$out)}'
exit 0
