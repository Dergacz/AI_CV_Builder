#!/usr/bin/env bash
# Codex PostToolUse hook — equivalent of .claude/hooks/lint.sh.
#
# Key difference from Claude Code: Codex edits files via the `apply_patch` tool,
# so stdin gives a PATCH BLOB in `tool_input.command`, not a clean
# `tool_input.file_path`. We therefore parse the touched paths out of the
# apply_patch envelope (`*** Update File:` / `*** Add File:` lines) instead of
# reading a single field. Everything else mirrors the Claude version.
set -uo pipefail

INPUT=$(cat)

# Only act on the edit tool (apply_patch); ignore Bash/MCP/etc.
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
case "$TOOL" in
  apply_patch|Edit|Write) ;;
  *) exit 0 ;;
esac

# Resolve project root from stdin so relative patch paths resolve.
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty')
[ -n "$CWD" ] && cd "$CWD" || true

# Extract the file path(s) the patch touches (a patch may change several files).
PATCH=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
FILES=$(printf '%s' "$PATCH" | sed -nE 's/^\*\*\* (Update|Add) File: (.*)$/\2/p')
[ -n "$FILES" ] || exit 0

# Keep only lintable source files that still exist on disk.
TARGETS=()
while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$f" in
    *.ts|*.tsx|*.astro|*.js|*.jsx|*.mjs|*.cjs) [ -f "$f" ] && TARGETS+=("$f") ;;
  esac
done <<< "$FILES"
[ ${#TARGETS[@]} -eq 0 ] && exit 0

OUT=$(npx eslint "${TARGETS[@]}" 2>&1)
[ $? -eq 0 ] && exit 0

# Signal: block and feed the eslint output back into the agent's context.
# Codex reads top-level decision/reason AND hookSpecificOutput.additionalContext.
OUT=$(printf '%s' "$OUT" | tail -c 8000)
jq -n --arg out "$OUT" '{
  decision: "block",
  reason: ("ESLint found problems in the file(s) you just edited:\n\n" + $out),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $out
  }
}'
exit 0
