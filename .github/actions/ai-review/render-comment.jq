# Renders a reviewer report (JSON matching `reviewSchema`) as the PR comment body.
# Kept out of action.yml so it can be exercised standalone:
#   jq -rf render-comment.jq --arg marker M --arg header H --arg model M --arg run_url U report.json

def sev_rank: {"critical": 0, "major": 1, "minor": 2, "nit": 3}[.severity] // 4;
def sev_icon: {"critical": "🛑", "major": "⚠️", "minor": "🔸", "nit": "·"}[.severity] // "•";
def loc:
  (if .line == null then .file else "\(.file):\(.line)" end)
  + (if (.symbol // "") == "" then "" else " · \(.symbol)" end);
def tally($s): [.findings[] | select(.severity == $s)] | length;

# One line of "criterion N/10", in the schema's own key order. Guarded with `//`
# so a report from an older reviewer, which carries no `scores`, still renders.
def scoreboard:
  (.scores // {}) | to_entries | map("\(.key) **\(.value)**/10") | join(" · ");

# The suggestion is emitted as markdown so code fences and generics survive, which
# means a literal </details> from the model would close the wrapper early and wreck
# the rest of the comment. Neutralise only those two tags: a blanket @html would
# render `Array<string>` inside a code fence as `Array&lt;string&gt;`.
def unwrap_safe: gsub("(?i)</details>"; "&lt;/details&gt;") | gsub("(?i)</summary>"; "&lt;/summary&gt;");

[
  $marker,
  "### \($header)",
  "",
  (.summary // "_The model returned no summary._"),
  "",
  "**Findings: \(.findings | length)** — \(tally("critical")) critical, \(tally("major")) major, \(tally("minor")) minor, \(tally("nit")) nit",
  "",
  (if (.scores // {} | length) == 0 then empty else scoreboard, "" end),
  (
    if (.findings | length) == 0 then
      "_Nothing to flag._"
    else
      (
        .findings
        | sort_by(sev_rank)
        | .[]
        | "<details>",
          "<summary>\(sev_icon) <b>\(.severity)</b> · <code>\(loc | @html)</code> · \(.category | @html) — \(.summary | @html)</summary>",
          "",
          (.suggestion | unwrap_safe),
          "",
          "</details>"
      )
    end
  ),
  "",
  "---",
  "<sub>Reviewed by `\($model)` · [workflow run](\($run_url))</sub>"
]
| join("\n")
