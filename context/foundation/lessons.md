# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## <Rule title>

- **Context**: `src/lib/services/cv-generation.ts:234` — provider calls and structured AI output generation.
- **Problem**: The service has a timeout, but no explicit output token cap, and the model-facing schema leaves arrays/strings unbounded. That can raise latency, cost, and response parsing load.
- **Rule**: <fill in>
- **Applies to**: <fill in>
