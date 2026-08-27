# 06 - Looks Reasonable, But Violates Honest Failure

The reviewer must notice that an invalid model response is now turned into `ok: true` with
silently emptied sections. The user receives a CV without work experience instead of an
honest error, and the substitution is visible only through an advisory warning. Also,
`report(..., "schemaMismatch")` no longer runs on the repaired path, so the degradation is
invisible in observability.

Secondary issue: the fallback `"Draft summary unavailable."` is hardcoded English copy
that reaches Polish and Russian users outside `*-copy.ts`, and `low_confidence` is reused
with a meaning different from the prompt contract.
