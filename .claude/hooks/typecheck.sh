#!/usr/bin/env bash
# PostToolUse(Write|Edit) hook: typecheck the project after a source edit.
# `astro check` has no single-file mode, so this runs the whole-project check
# but only fires on source-file edits (not config/json/md).
set -uo pipefail

FILE=$(jq -r '.tool_input.file_path // empty')
[ -n "$FILE" ] || exit 0

case "$FILE" in
  *.ts|*.tsx|*.astro) ;;
  *) exit 0 ;;
esac

OUT=$(cd "$CLAUDE_PROJECT_DIR" && npm run typecheck 2>&1)
STATUS=$?
[ $STATUS -eq 0 ] && exit 0

# Block and feed the astro check diagnostics back to the agent.
# Truncate to stay under the 10k-char cap.
OUT=$(printf '%s' "$OUT" | tail -c 8000)
jq -n --arg out "$OUT" \
  '{decision:"block", reason:("astro check (typecheck) failed after your edit:\n\n"+$out)}'
exit 0
