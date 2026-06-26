# Pricing match learning loop

Pricing match learning is intentionally conservative. Raw match telemetry is first classified into calibrated quality signals, then aggregated into `pricing_match_learning_summaries`. Ranking must never read raw `pricing_match_events` directly.

The guarded path is:

```text
raw match event → quality signal → aggregated learning summary → guarded ranking influence
```

## Ranking influence

The pricing matcher may use `pricing_match_learning_summaries` only as a low-weight tie-breaker for candidates that already passed normal server-side compatibility checks. The summaries are loaded server-side by chain, store scope, and normalized query; the table is not exposed directly to clients.

A summary can affect ranking only when all relevant guards pass:

- `sample_count >= 3`.
- The summarized product id exists in the current candidate set.
- The candidate already has normal match confidence; learning cannot affect `confidence: none` candidates.
- The confidence score is clearly positive or clearly negative.
  - Positive boost: `confidence_score >= 0.6`.
  - Negative penalty: `confidence_score <= -0.75`.
  - Negative penalty also requires `suspicious_count >= 2`.

The score is intentionally small:

- Learned good preference adds only a small `learningScore` boost.
- Learned suspicious preference applies a modest `learningScore` penalty.
- Learning must not dominate semantic, product/category, package, or hard compatibility scoring.

## Hard mismatch rules always win

Learning must never rescue or override:

- Prepared-food/simple-ingredient penalties.
- Hard product incompatibility checks.
- Quantity/package sanity checks.
- `confidence: none` results.
- Missing product cases.

If a candidate is already heavily penalized as a hard mismatch, positive learning is ignored for that candidate.

## Operational notes

- Scope learning by chain and store when relevant.
- Prefer aggregate summaries over raw events in all ranking paths.
- Keep debug visibility limited to ranking reasons/score breakdown, such as `learned_preference_boost`, `learned_suspicious_penalty`, and `learningScore`.
